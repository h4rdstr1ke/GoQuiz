package models

import (
	"time"

	"github.com/google/uuid"
)

// --- ENUM из базы ---

type UserRole string

const (
	RoleParticipant UserRole = "participant"
	RoleOrganizer   UserRole = "organizer"
)

type QuestionType string

const (
	TypeSingleChoice   QuestionType = "single_choice"
	TypeMultipleChoice QuestionType = "multiple_choice"
	TypeText           QuestionType = "text"
)

type SessionStatus string

const (
	StatusWaiting   SessionStatus = "waiting"
	StatusActive    SessionStatus = "active"
	StatusCompleted SessionStatus = "completed"
)

// --- Структуры таблиц ---

type GameResult struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	UserID    uuid.UUID `gorm:"type:uuid;not null"`
	QuizID    uuid.UUID `gorm:"type:uuid;not null"`
	Score     int       `gorm:"not null"`
	Place     int       `gorm:"not null;default:0"`
	CreatedAt time.Time
	Quiz      Quiz `gorm:"foreignKey:QuizID"`
}

type User struct {
	ID           uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Username     string    `gorm:"unique;not null" json:"username"`
	Email        string    `gorm:"unique;not null" json:"email"`
	PasswordHash string    `gorm:"not null" json:"-"` // Скрываем из JSON ответов
	Role         UserRole  `gorm:"type:user_role;default:'participant'" json:"role"`
	CreatedAt    time.Time `gorm:"autoCreateTime" json:"createdAt"`
}

type Quiz struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	CreatorID   uuid.UUID `gorm:"type:uuid;not null" json:"creatorId"`
	Title       string    `gorm:"not null" json:"title"`
	Description string    `json:"description"`
	Category    string    `json:"category"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updatedAt"`

	// Связи для GORM
	Questions []Question `gorm:"foreignKey:QuizID" json:"questions,omitempty"`
}

type Question struct {
	ID               uuid.UUID    `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	QuizID           uuid.UUID    `gorm:"type:uuid;not null" json:"quizId"`
	ContentText      string       `gorm:"not null" json:"contentText"`
	ImageURL         *string      `json:"imageUrl,omitempty"` // Указатель для nullable полей
	Type             QuestionType `gorm:"type:question_type;not null" json:"type"`
	TimeLimitSeconds int          `gorm:"default:30" json:"timeLimitSeconds"`
	Points           int          `gorm:"default:10" json:"points"`
	SortOrder        int          `gorm:"not null" json:"sortOrder"`
	CreatedAt        time.Time    `gorm:"autoCreateTime" json:"createdAt"`

	// Связи
	Options []QuestionOption `gorm:"foreignKey:QuestionID" json:"options,omitempty"`
}

type QuestionOption struct {
	ID         uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	QuestionID uuid.UUID `gorm:"type:uuid;not null" json:"questionId"`
	OptionText string    `gorm:"not null" json:"optionText"`
	IsCorrect  bool      `gorm:"default:false" json:"isCorrect"`
}

type QuizSession struct {
	ID          uuid.UUID     `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	QuizID      uuid.UUID     `gorm:"type:uuid;not null" json:"quizId"`
	OrganizerID uuid.UUID     `gorm:"type:uuid;not null" json:"organizerId"`
	RoomCode    string        `gorm:"unique;not null" json:"roomCode"`
	Status      SessionStatus `gorm:"type:session_status;default:'waiting'" json:"status"`
	StartedAt   *time.Time    `json:"startedAt,omitempty"`
	EndedAt     *time.Time    `json:"endedAt,omitempty"`
	Quiz        Quiz          `gorm:"foreignKey:QuizID"`
}

type SessionParticipant struct {
	ID         uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	SessionID  uuid.UUID `gorm:"type:uuid;not null" json:"sessionId"`
	UserID     uuid.UUID `gorm:"type:uuid;not null" json:"userId"`
	TotalScore int       `gorm:"default:0" json:"totalScore"`
	JoinedAt   time.Time `gorm:"autoCreateTime" json:"joinedAt"`
}

type ParticipantAnswer struct {
	ID               uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ParticipantID    uuid.UUID  `gorm:"type:uuid;not null" json:"participantId"`
	QuestionID       uuid.UUID  `gorm:"type:uuid;not null" json:"questionId"`
	SelectedOptionID *uuid.UUID `gorm:"type:uuid" json:"selectedOptionId,omitempty"`
	TextAnswer       *string    `json:"textAnswer,omitempty"`
	IsCorrect        bool       `gorm:"not null" json:"isCorrect"`
	PointsAwarded    int        `gorm:"default:0" json:"pointsAwarded"`
	AnsweredAt       time.Time  `gorm:"autoCreateTime" json:"answeredAt"`
}
