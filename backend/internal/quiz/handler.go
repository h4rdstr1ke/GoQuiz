package quiz

import (
	"net/http"

	"quiz-backend/internal/database"
	"quiz-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct{}

type QuizInput struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
	Category    string `json:"category"`
}

// CreateQuiz — создание нового квиза
func (h *Handler) CreateQuiz(c *gin.Context) {
	// Проверяем, что пользователь — организатор
	role, _ := c.Get("role")
	if role != string(models.RoleOrganizer) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Только организаторы могут создавать квизы"})
		return
	}

	var input QuizInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверные данные формы"})
		return
	}

	// Достаем ID пользователя из контекста
	userIDStr := c.MustGet("userID").(string)
	creatorID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка обработки ID пользователя"})
		return
	}

	quiz := models.Quiz{
		CreatorID:   creatorID,
		Title:       input.Title,
		Description: input.Description,
		Category:    input.Category,
	}

	if err := database.DB.Create(&quiz).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать квиз"})
		return
	}

	c.JSON(http.StatusCreated, quiz)
}

// GetMyQuizzes — получение квизов текущего организатора
func (h *Handler) GetMyQuizzes(c *gin.Context) {
	userIDStr := c.MustGet("userID").(string)

	var quizzes []models.Quiz
	// Ищем все квизы, где creator_id равен нашему ID
	if err := database.DB.Where("creator_id = ?", userIDStr).Find(&quizzes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении квизов"})
		return
	}

	c.JSON(http.StatusOK, quizzes)
}

// UpdateQuiz — редактирование квиза
func (h *Handler) UpdateQuiz(c *gin.Context) {
	quizID := c.Param("id")
	userIDStr := c.MustGet("userID").(string)

	var input QuizInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверные данные"})
		return
	}

	var quiz models.Quiz
	// Находим квиз и сразу проверяем, что его создал текущий пользователь
	if err := database.DB.Where("id = ? AND creator_id = ?", quizID, userIDStr).First(&quiz).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Квиз не найден или у вас нет прав на его изменение"})
		return
	}

	// Обновляем поля
	quiz.Title = input.Title
	quiz.Description = input.Description
	quiz.Category = input.Category

	if err := database.DB.Save(&quiz).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при сохранении квиза"})
		return
	}

	c.JSON(http.StatusOK, quiz)
}

type OptionInput struct {
	OptionText string `json:"option_text" binding:"required"`
	IsCorrect  bool   `json:"is_correct"`
}

type AddQuestionInput struct {
	ContentText      string        `json:"content_text" binding:"required"`
	Type             string        `json:"type" binding:"required"`
	TimeLimitSeconds int           `json:"time_limit_seconds"`
	Points           int           `json:"points"`
	SortOrder        int           `json:"sort_order" binding:"required"`
	Options          []OptionInput `json:"options"`
}

// AddQuestion добавляет вопрос и его варианты в квиз
func (h *Handler) AddQuestion(c *gin.Context) {
	quizIDStr := c.Param("id")
	userIDStr := c.MustGet("userID").(string)

	var input AddQuestionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверные данные вопроса"})
		return
	}

	// Проверяем существует ли квиз и принадлежит ли он текущему юзеру
	var quiz models.Quiz
	if err := database.DB.Where("id = ? AND creator_id = ?", quizIDStr, userIDStr).First(&quiz).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Квиз не найден или нет прав на редактирование"})
		return
	}

	quizUUID, _ := uuid.Parse(quizIDStr)

	//  Транзакция (если варианты не сохранятся, вопрос тоже откатится)
	tx := database.DB.Begin()

	question := models.Question{
		QuizID:           quizUUID,
		ContentText:      input.ContentText,
		Type:             models.QuestionType(input.Type),
		TimeLimitSeconds: input.TimeLimitSeconds,
		Points:           input.Points,
		SortOrder:        input.SortOrder,
	}

	if err := tx.Create(&question).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при создании вопроса"})
		return
	}

	// Сохраняем варианты ответов (если это тестовый вопрос)
	if input.Type != string(models.TypeText) && len(input.Options) > 0 {
		var options []models.QuestionOption
		for _, opt := range input.Options {
			options = append(options, models.QuestionOption{
				QuestionID: question.ID,
				OptionText: opt.OptionText,
				IsCorrect:  opt.IsCorrect,
			})
		}

		if err := tx.Create(&options).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при сохранении вариантов ответов"})
			return
		}
	}

	// Подтверждаем транзакцию
	tx.Commit()

	c.JSON(http.StatusCreated, gin.H{
		"message":  "Вопрос успешно добавлен",
		"question": question,
	})
}

// Структура ответа для фронтенда
type HistoryResponse struct {
	QuizTitle string `json:"quiz_title"`
	Score     int    `json:"score"`
	Place     int    `json:"place"`
	PlayedAt  string `json:"played_at"`
}

// GetMyHistory — получение истории прохождения квизов текущего участника
func (h *Handler) GetMyHistory(c *gin.Context) {
	userIDStr := c.MustGet("userID").(string)

	var results []models.GameResult
	// Подтягиваем связанные квизы (Preload("Quiz")), чтобы получить название, и сортируем от новых к старым
	if err := database.DB.Preload("Quiz").Where("user_id = ?", userIDStr).Order("created_at desc").Find(&results).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении истории"})
		return
	}

	var history []HistoryResponse
	for _, r := range results {
		history = append(history, HistoryResponse{
			QuizTitle: r.Quiz.Title,
			Score:     r.Score,
			Place:     r.Place,
			PlayedAt:  r.CreatedAt.Format("02.01.2006 15:04"),
		})
	}

	c.JSON(http.StatusOK, history)
}
