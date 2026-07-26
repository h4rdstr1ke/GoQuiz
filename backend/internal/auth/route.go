package auth

import "github.com/gin-gonic/gin"

func RegisterRoutes(router *gin.RouterGroup) {
	h := &Handler{}

	router.POST("/register", h.Register)
	router.POST("/login", h.Login)
}
