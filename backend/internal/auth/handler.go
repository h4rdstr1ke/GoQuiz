package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct{}

func (h *Handler) Register(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Здесь будет логика регистрации"})
}

func (h *Handler) Login(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Здесь будет логика входа и выдача JWT"})
}
