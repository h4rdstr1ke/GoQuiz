package main

import (
	"log"
	"time"

	"quiz-backend/internal/auth"
	"quiz-backend/internal/database"
	"quiz-backend/internal/quiz"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// Инициализация БД
	database.Connect()

	// Настройка Gin
	r := gin.Default()

	// Настройка CORS для работы с React
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Регистрация маршрутов
	api := r.Group("/api/v1")

	// Подключаем домен авторизации
	auth.RegisterRoutes(api.Group("/auth"))

	// Подключаем домен квизов
	quiz.RegisterRoutes(api.Group("/quizzes"))

	// Запуск сервера
	log.Println("Сервер запущен на порту 8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Ошибка при запуске сервера: %v", err)
	}
}
