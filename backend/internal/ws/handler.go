package ws

import (
	"fmt"
	"math/rand"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	Manager *Manager
}

func NewHandler(m *Manager) *Handler {
	return &Handler{Manager: m}
}

// CreateSessionInput описывает JSON для создания комнаты
type CreateSessionInput struct {
	QuizID string `json:"quiz_id" binding:"required"`
}

// CreateSession (REST) организатор вызывает этот метод чтобы открыть комнату
func (h *Handler) CreateSession(c *gin.Context) {
	var input CreateSessionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Не указан ID квиза"})
		return
	}

	// Генерируем случайный 6-значный код комнаты
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	roomCode := fmt.Sprintf("%06d", r.Intn(1000000))

	// Создаем и запускаем комнату в менеджере
	h.Manager.CreateRoom(roomCode, input.QuizID)

	c.JSON(http.StatusOK, gin.H{
		"room_code": roomCode,
		"message":   "Игровая комната успешно создана",
	})
}

// JoinSession (WebSocket) — игроки и организатор подключаются по коду комнаты
func (h *Handler) JoinSession(c *gin.Context) {
	roomCode := c.Param("roomCode")

	// Проверяем, существует ли комната в памяти
	room, exists := h.Manager.GetRoom(roomCode)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Комната не найдена или игра уже завершена"})
		return
	}

	// Превращаем HTTP-запрос в WebSocket-соединение
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	// todo данные из JWT токена, переданного в параметрах подключения
	// Для тестов пока будем брать их из query-параметров (например: ?username=Ivan&role=participant)
	userID := c.DefaultQuery("userId", "guest")
	username := c.DefaultQuery("username", "Аноним")
	role := c.DefaultQuery("role", "participant")

	// Создаем клиента
	client := &Client{
		Room:     room,
		Conn:     conn,
		Send:     make(chan []byte, 256),
		UserID:   userID,
		Username: username,
		Role:     role,
	}

	// Отправляем клиента в канал регистрации комнаты
	client.Room.Register <- client

	// Запускаем горутины для чтения и записи
	// Они будут работать параллельно пока соединение не прервется
	go client.WritePump()
	go client.ReadPump()
}

// RegisterRoutes регистрирует маршруты движка в Gin
func RegisterRoutes(router *gin.RouterGroup, manager *Manager) {
	h := NewHandler(manager)

	// Создание сессии (обычный POST запрос)
	router.POST("/create", h.CreateSession)

	// Подключение к сессии (WebSocket соединение)
	router.GET("/join/:roomCode", h.JoinSession)
}
