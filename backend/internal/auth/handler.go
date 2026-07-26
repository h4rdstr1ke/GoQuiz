package auth

import (
	"net/http"

	"quiz-backend/internal/database"
	"quiz-backend/internal/utils"
	"quiz-backend/models"

	"github.com/gin-gonic/gin"
)

type Handler struct{}

// Структуры входящих JSON-запросов
type RegisterInput struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Role     string `json:"role" binding:"required"`
}

type LoginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func (h *Handler) Register(c *gin.Context) {
	var input RegisterInput

	// Валидация входящего JSON
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверные данные", "details": err.Error()})
		return
	}

	// Хэширование пароля
	hashedPassword, err := utils.HashPassword(input.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при обработке пароля"})
		return
	}

	// Преобразование строковой роли в кастомный тип
	role := models.RoleParticipant
	if input.Role == "organizer" {
		role = models.RoleOrganizer
	}

	user := models.User{
		Username:     input.Username,
		Email:        input.Email,
		PasswordHash: hashedPassword,
		Role:         role,
	}

	// если email или username заняты возвр ошибку
	if err := database.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Пользователь с таким email или именем уже существует"})
		return
	}

	// Сразу генерируем токен, чтобы пользователю не пришлось логиниться после регистрации
	token, _ := utils.GenerateJWT(user.ID.String(), string(user.Role))

	c.JSON(http.StatusCreated, gin.H{
		"message": "Регистрация успешна",
		"token":   token,
		"user":    user,
	})
}

func (h *Handler) Login(c *gin.Context) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверные данные"})
		return
	}

	var user models.User
	// Ищем пользователя по email
	if err := database.DB.Where("email = ?", input.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Неверный email или пароль"})
		return
	}

	// Проверяем совпадение паролей
	if !utils.CheckPasswordHash(input.Password, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Неверный email или пароль"})
		return
	}

	token, err := utils.GenerateJWT(user.ID.String(), string(user.Role))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка генерации токена"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Вход выполнен успешно",
		"token":   token,
		"user":    user,
	})
}
