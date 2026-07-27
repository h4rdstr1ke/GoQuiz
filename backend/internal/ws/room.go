package ws

import (
	"encoding/json"
	"log"

	"quiz-backend/internal/database"
	"quiz-backend/models"

	"sort"

	"github.com/google/uuid"
)

// ClientMessage связывает конкретного отправителя с его сообщением
type ClientMessage struct {
	Client  *Client
	Message Message
}

// Room представляет собой одну игровую сессию
type Room struct {
	RoomCode string
	QuizID   string
	Manager  *Manager

	// Все подкл клиенты и организаторы
	Clients map[*Client]bool

	// Игровое состояние
	Questions            []models.Question
	CurrentQuestionIndex int
	Scores               map[string]int

	// Каналы для управления состоянием комнаты
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan []byte
	Receive    chan *ClientMessage
}

// NewRoom инициализирует новую комнату
func NewRoom(roomCode string, quizID string, manager *Manager) *Room {
	return &Room{
		RoomCode:             roomCode,
		QuizID:               quizID,
		Manager:              manager,
		Clients:              make(map[*Client]bool),
		Scores:               make(map[string]int),
		CurrentQuestionIndex: -1, // -1 означает что игра еще не началась
		Register:             make(chan *Client),
		Unregister:           make(chan *Client),
		Broadcast:            make(chan []byte),
		Receive:              make(chan *ClientMessage),
	}
}

// Запускает игровой цикл комнаты (вызывается как горутина)
func (r *Room) Run() {
	log.Printf("Комната %s запущена", r.RoomCode)

	// Загружаем вопросы квиза из БД при создании комнаты
	if err := database.DB.Preload("Options").Where("quiz_id = ?", r.QuizID).Order("sort_order asc").Find(&r.Questions).Error; err != nil {
		log.Printf("Ошибка загрузки вопросов для комнаты %s: %v", r.RoomCode, err)
	}

	for {
		select {
		// КОГДА КЛИЕНТ ПОДКЛЮЧАЕТСЯ
		case client := <-r.Register:
			r.Clients[client] = true
			log.Printf("В комнату %s зашел: %s", r.RoomCode, client.Username)

			// Рассылаем всем актуальный список
			r.sendPlayersList()

		case client := <-r.Unregister:
			if _, ok := r.Clients[client]; ok {
				delete(r.Clients, client)
				close(client.Send)
				if len(r.Clients) == 0 {
					r.Manager.RemoveRoom(r.RoomCode)
					return
				}
				// при выходе рассылаем снова
				r.sendPlayersList()
			}

		// --- ОБРАБОТКА ИГРОВОЙ ЛОГИКИ ---
		case cMsg := <-r.Receive:
			switch cMsg.Message.Type {

			case EventGameStarted:
				// Игру может начать только организатор
				if cMsg.Client.Role != "organizer" {
					continue
				}
				r.CurrentQuestionIndex = 0

				// Отправляем всем сообщение о старте и сразу первый вопрос
				r.broadcastJSON(Message{Type: EventGameStarted})
				r.sendCurrentQuestion()

			case EventNextQuestion:
				// Игру может продолжить/завершить только организатор
				if cMsg.Client.Role != "organizer" {
					continue
				}
				r.CurrentQuestionIndex++
				if r.CurrentQuestionIndex >= len(r.Questions) {
					// --- СОХРАНЕНИЕ ИСТОРИИ ---
					quizUUID, _ := uuid.Parse(r.QuizID)

					// Список для сортировки, чтобы узнать места
					type userScore struct {
						Username string
						Score    int
					}
					var sortedScores []userScore
					for un, sc := range r.Scores {
						sortedScores = append(sortedScores, userScore{Username: un, Score: sc})
					}

					// Сортируем от большего к меньшему
					sort.Slice(sortedScores, func(i, j int) bool {
						return sortedScores[i].Score > sortedScores[j].Score
					})

					// Запоминаем место каждого игрока
					places := make(map[string]int)
					for i, us := range sortedScores {
						places[us.Username] = i + 1
					}

					// Сохраняем в базу данных
					for client := range r.Clients {
						if client.Role == "participant" {
							score := r.Scores[client.Username]
							place := places[client.Username] // Достаем вычисленное место

							userUUID, err := uuid.Parse(client.UserID)
							if err != nil {
								log.Printf("Не удалось сохранить историю для %s: неверный формат UserID", client.Username)
								continue
							}

							if err := database.DB.Create(&models.GameResult{
								UserID: userUUID,
								QuizID: quizUUID,
								Score:  score,
								Place:  place, // <-- Сохраняем место в БД!
							}).Error; err != nil {
								log.Printf("Ошибка записи в БД для %s: %v", client.Username, err)
							} else {
								log.Printf("История сохранена: %s (Счет: %d, Место: %d)", client.Username, score, place)
							}
						}
					}
					// --------------------------

					r.broadcastJSON(Message{Type: EventGameCompleted, Payload: r.Scores})
				} else {
					r.sendCurrentQuestion()
				}

			case EventSubmitAnswer:
				// Защита: вдруг ответ прилетел, когда вопрос еще не задан или игра окончена
				if r.CurrentQuestionIndex < 0 || r.CurrentQuestionIndex >= len(r.Questions) {
					continue
				}

				// Т.к. Payload у нас interface{}, нужно перегнать его в нашу структуру SubmitAnswerPayload
				// через повторный Marshal/Unmarshal
				payloadBytes, err := json.Marshal(cMsg.Message.Payload)
				if err != nil {
					log.Printf("Ошибка обработки ответа от %s: %v", cMsg.Client.Username, err)
					continue
				}

				var answer SubmitAnswerPayload
				if err := json.Unmarshal(payloadBytes, &answer); err != nil {
					log.Printf("Ошибка парсинга ответа от %s: %v", cMsg.Client.Username, err)
					continue
				}

				// Достаем текущий вопрос
				q := r.Questions[r.CurrentQuestionIndex]
				isCorrect := false

				// Ищем выбранный вариант ответа среди опций вопроса
				for _, opt := range q.Options {
					if opt.ID.String() == answer.AnswerID {
						isCorrect = opt.IsCorrect
						break
					}
				}

				// Если ответ верный, начисляем баллы по Username
				if isCorrect {
					r.Scores[cMsg.Client.Username] += 100
				} else if _, exists := r.Scores[cMsg.Client.Username]; !exists {
					r.Scores[cMsg.Client.Username] = 0 // Добавляем студента с 0 баллов, если он ошибся
				}

				// Формируем персональное сообщение с результатом
				resultMsg := Message{
					Type: EventAnswerResult,
					Payload: AnswerResultPayload{
						IsCorrect: isCorrect,
						Score:     r.Scores[cMsg.Client.Username],
					},
				}

				// Отправляем результат ТОЛЬКО тому, кто ответил (в его личный канал)
				if bytes, err := json.Marshal(resultMsg); err == nil {
					cMsg.Client.Send <- bytes
				}

				// (имя ответившего + обновленные баллы), чтобы React его не проглотил
				organizerUpdateMsg := Message{
					Type: EventPlayerAnswered,
					Payload: map[string]interface{}{
						"username":    cMsg.Client.Username,
						"leaderboard": r.Scores,
					},
				}
				if orgBytes, err := json.Marshal(organizerUpdateMsg); err == nil {
					for client := range r.Clients {
						// Отправляем всем, кто не participant (надежная проверка на организатора)
						if client.Role != "participant" {
							client.Send <- orgBytes
						}
					}
				}

				log.Printf("Игрок %s ответил %t, текущий счет: %d", cMsg.Client.Username, isCorrect, r.Scores[cMsg.Client.Username])
			}

		case message := <-r.Broadcast:
			for client := range r.Clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(r.Clients, client)
				}
			}
		}
	}
}

// Вспомогательная функция для отправки JSON всем клиентам
func (r *Room) broadcastJSON(msg Message) {
	bytes, _ := json.Marshal(msg)

	// Рассылаем сообщения напрямую в буферы клиентов, не блокируя основной цикл
	for client := range r.Clients {
		select {
		case client.Send <- bytes:
		default:
			close(client.Send)
			delete(r.Clients, client)
		}
	}
}

// Вспомогательная функция для отправки текущего вопроса (без флага IsCorrect)
func (r *Room) sendCurrentQuestion() {
	if r.CurrentQuestionIndex >= len(r.Questions) {
		return
	}

	q := r.Questions[r.CurrentQuestionIndex]

	// Собираем чистый объект вопроса для рассылки
	type SafeOption struct {
		ID   string `json:"id"`
		Text string `json:"text"`
	}

	var safeOptions []SafeOption
	for _, opt := range q.Options {
		safeOptions = append(safeOptions, SafeOption{
			ID:   opt.ID.String(),
			Text: opt.OptionText,
		})
	}

	// Считаем общее число участников (не организаторов) в комнате
	participantsCount := 0
	for c := range r.Clients {
		if c.Role != "organizer" && c.Role != "Organizer" {
			participantsCount++
		}
	}

	r.broadcastJSON(Message{
		Type: EventQuestionShow,
		Payload: map[string]interface{}{
			"question_text":      q.ContentText,
			"options":            safeOptions,
			"time_limit":         q.TimeLimitSeconds,
			"total_participants": participantsCount,
		},
	})
}

// Вспомогательная функция для рассылки полного списка участников
func (r *Room) sendPlayersList() {
	type PlayerInfo struct {
		Username string `json:"username"`
		Role     string `json:"role"`
	}

	var players []PlayerInfo
	for c := range r.Clients {
		players = append(players, PlayerInfo{
			Username: c.Username,
			Role:     c.Role,
		})
	}

	r.broadcastJSON(Message{
		Type:    EventPlayersList,
		Payload: players,
	})
}
