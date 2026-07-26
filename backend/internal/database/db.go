package database

import (
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// Глобальная переменная для бd
var DB *gorm.DB

func Connect() {
	dsn := "host=localhost user=root password=secretpassword dbname=quiz_db port=5432 sslmode=disable"

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Ошибка подключения к базе данных: %v", err)
	}

	log.Println("Успешное подключение к PostgreSQL")
}
