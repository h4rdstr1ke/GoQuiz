package quiz

import (
	"quiz-backend/internal/middleware"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(router *gin.RouterGroup) {
	h := &Handler{}

	// Все операции с квизами требуют авторизации
	protected := router.Group("/")
	protected.Use(middleware.JWTAuth())
	{
		protected.POST("/", h.CreateQuiz)
		protected.GET("/", h.GetMyQuizzes)
		protected.PUT("/:id", h.UpdateQuiz)
		protected.POST("/:id/questions", h.AddQuestion)
	}
}
