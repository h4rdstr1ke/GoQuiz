package middleware

import (
	"net/http"
	"strings"

	"quiz-backend/internal/utils"

	"github.com/gin-gonic/gin"
)

func JWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")

		// Проверяем, есть ли заголовок
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Отсутствует заголовок Authorization"})
			return
		}

		// Заголовок должен быть в формате "Bearer "
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Неверный формат токена"})
			return
		}

		tokenString := parts[1]

		// Проверяем токен
		claims, err := utils.VerifyJWT(tokenString)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Недействительный или просроченный токен"})
			return
		}

		// Извлекаем данные и сохраняем в контекст Gin
		// Теперь любой следующий хэндлер сможет получить userID
		c.Set("userID", claims["sub"])
		c.Set("role", claims["role"])

		c.Next()
	}
}
