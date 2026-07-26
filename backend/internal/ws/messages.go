package ws

// EventType определяет тип сообщения, которое мы отправляем или получаем
type EventType string

const (
	// Входящие (от фронтенда к серверу)
	EventSubmitAnswer EventType = "submit_answer"
	EventNextQuestion EventType = "next_question" // Только для организатора

	// Исходящие (от сервthe к фронтенду)
	EventPlayerJoined  EventType = "player_joined"
	EventGameStarted   EventType = "game_started"
	EventQuestionShow  EventType = "question_show"
	EventAnswerResult  EventType = "answer_result"
	EventGameCompleted EventType = "game_completed"
	EventError         EventType = "error"
)

// Универсальная обертка для всех WebSocket сообщений
type Message struct {
	Type    EventType   `json:"type"`
	Payload interface{} `json:"payload,omitempty"`
}

// Вспомогательные структуры для Payload
type PlayerJoinedPayload struct {
	Username string `json:"username"`
	Role     string `json:"role"`
}
