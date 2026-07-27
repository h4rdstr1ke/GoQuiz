package ws

import (
	"encoding/json"
	"log"
	"strings"
	"time"

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

	// Трекинг ответивших для защиты от двойных ответов и отправки game_state
	Answered map[string]bool
	// Время начала текущего вопроса для синхронизации таймера
	QuestionStartedAt time.Time

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
		Answered:             make(map[string]bool),
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

			// --- ВОССТАНОВЛЕНИЕ СЕССИИ (С СИНХРОНИЗАЦИЕЙ ТАЙМЕРА) ---
			if r.CurrentQuestionIndex >= 0 && r.CurrentQuestionIndex < len(r.Questions) {
				q := r.Questions[r.CurrentQuestionIndex]

				type SafeOption struct {
					ID   string `json:"id"`
					Text string `json:"text"`
				}

				var safeOptions []SafeOption
				// Для текстовых вопросов не шлем варианты
				if q.Type != models.TypeText {
					for _, opt := range q.Options {
						safeOptions = append(safeOptions, SafeOption{
							ID:   opt.ID.String(),
							Text: opt.OptionText,
						})
					}
				}

				participantsCount := 0
				for c := range r.Clients {
					if c.Role != "organizer" && c.Role != "Organizer" {
						participantsCount++
					}
				}

				var answeredPlayers []string
				for name := range r.Answered {
					answeredPlayers = append(answeredPlayers, name)
				}

				// СИНХРОНИЗАЦИЯ ТАЙМЕРА
				timeLeft := q.TimeLimitSeconds - int(time.Since(r.QuestionStartedAt).Seconds())
				if timeLeft < 0 {
					timeLeft = 0
				}

				reconnectMsg := Message{
					Type: EventGameState,
					Payload: map[string]interface{}{
						"question_index":     r.CurrentQuestionIndex,
						"question_text":      q.ContentText,
						"image_url":          q.ImageURL,
						"type":               q.Type,
						"options":            safeOptions,
						"time_limit":         timeLeft, // Передаем оставшееся время
						"total_participants": participantsCount,
						"leaderboard":        r.Scores,
						"answered_players":   answeredPlayers,
						"has_answered":       r.Answered[client.Username],
					},
				}
				if msgBytes, err := json.Marshal(reconnectMsg); err == nil {
					client.Send <- msgBytes
				}
			} else if r.CurrentQuestionIndex >= len(r.Questions) && len(r.Questions) > 0 {
				endMsg, _ := json.Marshal(Message{
					Type:    EventGameCompleted,
					Payload: r.Scores,
				})
				client.Send <- endMsg
			}

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
				r.Answered = make(map[string]bool) // Сбрасываем ответы

				// Отправляем всем сообщение о старте и сразу первый вопрос
				r.broadcastJSON(Message{Type: EventGameStarted})
				r.sendCurrentQuestion()

			case EventNextQuestion:
				// Игру может продолжить/завершить только организатор
				if cMsg.Client.Role != "organizer" {
					continue
				}
				r.CurrentQuestionIndex++
				r.Answered = make(map[string]bool) // Сбрасываем ответы для нового вопроса

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
								UserID:   userUUID,
								QuizID:   quizUUID,
								Score:    score,
								RoomCode: r.RoomCode,
								Place:    place,
							}).Error; err != nil {
								log.Printf("Ошибка записи в БД для %s: %v", client.Username, err)
							} else {
								log.Printf("История сохранена: %s (Счет: %d, Место: %d)", client.Username, score, place)
							}
						}
					}
					// --------------------------

					// --- СОХРАНЕНИЕ СЕССИИ ДЛЯ ОРГАНИЗАТОРА ---
					var quiz models.Quiz
					// Достаем creator_id, чтобы записать его как организатора
					if err := database.DB.Select("creator_id").First(&quiz, "id = ?", quizUUID).Error; err == nil {
						now := time.Now()
						session := models.QuizSession{
							QuizID:      quizUUID,
							OrganizerID: quiz.CreatorID,
							RoomCode:    r.RoomCode,
							Status:      models.StatusCompleted,
							EndedAt:     &now,
						}
						database.DB.Create(&session)
						log.Printf("Сессия %s сохранена в историю организатора", r.RoomCode)
					}

					r.broadcastJSON(Message{Type: EventGameCompleted, Payload: r.Scores})
				} else {
					r.sendCurrentQuestion()
				}

			case EventSubmitAnswer:
				// Защита: вдруг ответ прилетел, когда вопрос еще не задан или игра окончена
				if r.CurrentQuestionIndex < 0 || r.CurrentQuestionIndex >= len(r.Questions) {
					continue
				}

				// Блокируем двойные ответы
				if r.Answered[cMsg.Client.Username] {
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

				r.Answered[cMsg.Client.Username] = true // Помечаем как ответившего

				// Достаем текущий вопрос
				q := r.Questions[r.CurrentQuestionIndex]
				isCorrect := false

				// --- ЛОГИКА ПРОВЕРКИ РАЗНЫХ ТИПОВ ОТВЕТОВ ---
				switch q.Type {
				case models.TypeSingleChoice:
					if len(answer.AnswerIDs) > 0 {
						for _, opt := range q.Options {
							if opt.ID.String() == answer.AnswerIDs[0] {
								isCorrect = opt.IsCorrect
								break
							}
						}
					}
				case models.TypeMultipleChoice:
					// Собираем мапу правильных ответов
					correctIDs := make(map[string]bool)
					for _, opt := range q.Options {
						if opt.IsCorrect {
							correctIDs[opt.ID.String()] = true
						}
					}
					// Сравниваем количество и сами ответы
					if len(answer.AnswerIDs) > 0 && len(answer.AnswerIDs) == len(correctIDs) {
						isCorrect = true
						for _, id := range answer.AnswerIDs {
							if !correctIDs[id] {
								isCorrect = false
								break
							}
						}
					}
				case models.TypeText:
					// Очищаем от пробелов и приводим к нижнему регистру
					submittedText := strings.TrimSpace(strings.ToLower(answer.AnswerText))
					for _, opt := range q.Options {
						if strings.TrimSpace(strings.ToLower(opt.OptionText)) == submittedText {
							isCorrect = true
							break
						}
					}
				}

				// --- СИСТЕМА НАЧИСЛЕНИЯ БАЛЛОВ ---
				pointsEarned := 0
				if isCorrect {
					if q.PointSystem == "time" {
						// Динамическая система: чем быстрее, тем больше баллов
						elapsed := time.Since(r.QuestionStartedAt).Seconds()
						timeLeft := float64(q.TimeLimitSeconds) - elapsed
						if timeLeft < 0 {
							timeLeft = 0
						}

						multiplier := timeLeft / float64(q.TimeLimitSeconds)
						pointsEarned = int(float64(q.Points) * multiplier)

						// Минимум 10% от стоимости вопроса, даже если ответил на последней секунде
						minPoints := int(float64(q.Points) * 0.1)
						if pointsEarned < minPoints {
							pointsEarned = minPoints
						}
					} else {
						// Фиксированная система
						pointsEarned = q.Points
					}
				}

				// Если ответ верный, начисляем баллы по Username
				r.Scores[cMsg.Client.Username] += pointsEarned

				// Добавляем студента с 0 баллов, если он ошибся и его еще нет
				if _, exists := r.Scores[cMsg.Client.Username]; !exists {
					r.Scores[cMsg.Client.Username] = 0
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

				log.Printf("Игрок %s ответил %t (Баллов получено: %d), текущий счет: %d", cMsg.Client.Username, isCorrect, pointsEarned, r.Scores[cMsg.Client.Username])
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

	r.QuestionStartedAt = time.Now() // Фиксируем точное время запуска вопроса

	q := r.Questions[r.CurrentQuestionIndex]

	// Собираем чистый объект вопроса для рассылки
	type SafeOption struct {
		ID   string `json:"id"`
		Text string `json:"text"`
	}

	var safeOptions []SafeOption
	// Отправляем варианты только для тестов с выбором
	if q.Type != models.TypeText {
		for _, opt := range q.Options {
			safeOptions = append(safeOptions, SafeOption{
				ID:   opt.ID.String(),
				Text: opt.OptionText,
			})
		}
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
			"question_index":     r.CurrentQuestionIndex,
			"question_text":      q.ContentText,
			"image_url":          q.ImageURL, // Передаем картинку, если есть
			"type":               q.Type,     // Передаем тип вопроса
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
