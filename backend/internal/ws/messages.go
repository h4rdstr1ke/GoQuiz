package ws

// EventType определяет тип сообщения, которое мы отправляем или получаем
type EventType string

const (
	// Входящие (от фронтенда к серверу)
	EventSubmitAnswer EventType = "submit_answer"
	EventNextQuestion EventType = "next_question" // Только для организатора

	// Исходящие (от сервера к фронтенду)
	EventPlayersList   EventType = "players_list"  // Рассылка полного списка участников
	EventPlayerJoined  EventType = "player_joined" // Оставлено на всякий случай
	EventGameStarted   EventType = "game_started"
	EventQuestionShow  EventType = "question_show"
	EventAnswerResult  EventType = "answer_result"
	EventGameCompleted EventType = "game_completed"
	EventError         EventType = "error"

	EventLeaderboardUpdate EventType = "leaderboard_update"
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

// SubmitAnswerPayload — то, что присылает игрок при ответе
type SubmitAnswerPayload struct {
	AnswerID string `json:"answer_id"`
}

// AnswerResultPayload — то, что сервер отвечает игроку
type AnswerResultPayload struct {
	IsCorrect bool `json:"is_correct"`
	Score     int  `json:"score"`
}
