package auth

import (
	"net/http"
	"quiz-backend/internal/middleware"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(router *gin.RouterGroup) {
	h := &Handler{}

	router.POST("/register", h.Register)
	router.POST("/login", h.Login)

	// Группа маршрутов, требующих авторизации
	protected := router.Group("/")
	protected.Use(middleware.JWTAuth())
	{
		protected.GET("/me", func(c *gin.Context) {

			userID, _ := c.Get("userID")
			role, _ := c.Get("role")

			c.JSON(http.StatusOK, gin.H{
				"message": "Проверка токена - успех",
				"userID":  userID,
				"role":    role,
			})
		})
	}
}
