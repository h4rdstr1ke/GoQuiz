package ws

import (
	"encoding/json"
	"log"

	"quiz-backend/internal/database"
	"quiz-backend/models"
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
	Scores               map[string]int // UserID -> Total Score

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
		case client := <-r.Register:
			r.Clients[client] = true

			// Уведомляем всех, что зашел новый игрок
			joinMsg := Message{
				Type: EventPlayerJoined,
				Payload: PlayerJoinedPayload{
					Username: client.Username,
					Role:     client.Role,
				},
			}
			r.broadcastJSON(joinMsg)

		case client := <-r.Unregister:
			if _, ok := r.Clients[client]; ok {
				delete(r.Clients, client)
				close(client.Send)
				if len(r.Clients) == 0 {
					r.Manager.RemoveRoom(r.RoomCode)
					return
				}
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
				if cMsg.Client.Role != "organizer" {
					continue
				}
				r.CurrentQuestionIndex++
				if r.CurrentQuestionIndex >= len(r.Questions) {
					r.broadcastJSON(Message{Type: EventGameCompleted, Payload: r.Scores})
				} else {
					r.sendCurrentQuestion()
				}

			case EventSubmitAnswer:
				// проверка на правильность (сверяя с r.Questions[r.CurrentQuestionIndex])
				// и начисление баллов в r.Scores[cMsg.Client.UserID]
				log.Printf("Игрок %s ответил на вопрос", cMsg.Client.Username)
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
	r.Broadcast <- bytes
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

	r.broadcastJSON(Message{
		Type: EventQuestionShow,
		Payload: map[string]interface{}{
			"question_text": q.ContentText,
			"options":       safeOptions,
			"time_limit":    q.TimeLimitSeconds,
		},
	})
}
