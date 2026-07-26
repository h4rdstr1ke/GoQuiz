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
