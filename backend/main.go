package main

import (
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {

	dsn := "host=localhost user=root password=secretpassword dbname=quiz_db port=5432 sslmode=disable"

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Ошибка подключения к базе данных: %v", err)
	}

	log.Println("Успешное подключение")

	// Получаем базовый объект *sql.DB для проверки пинга
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("Ошибка получения объекта БД: %v", err)
	}

	if err := sqlDB.Ping(); err != nil {
		log.Fatalf("База данных не отвечает: %v", err)
	}

	log.Println("Пинг прошел успешно")
}
