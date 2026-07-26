package ws

import (
	"log"
	"net/http"
	"time"

	"encoding/json"

	"github.com/gorilla/websocket"
)

const (
	// Настройки таймаутов для поддержания живого соединения
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 1024
)

// upgrader превращает обычный HTTP-запрос в долгоживущее WebSocket соединение
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Разрешаем подключения с любых доменов (чтобы React с localhost:5173 мог подключиться)
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// Client оборачивает соединение и связывает его с комнатой
type Client struct {
	Room *Room
	Conn *websocket.Conn
	Send chan []byte // Буфер для сообщений, которые нужно отправить этому клиенту

	// Игровые данные
	UserID   string
	Role     string // "organizer" или "participant"
	Username string
}

// ReadPump постоянно слушает сокет на предмет новых сообщений от фронтенда
func (c *Client) ReadPump() {
	// Если мы выходим из функции, отключаем клиента и закрываем соединение
	defer func() {
		c.Room.Unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error { c.Conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })

	for {
		_, rawMessage, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Ошибка сокета у %s: %v", c.Username, err)
			}
			break
		}

		// Парсим входящий JSON
		var msg Message
		if err := json.Unmarshal(rawMessage, &msg); err != nil {
			log.Printf("Ошибка парсинга JSON от %s: %v", c.Username, err)
			continue
		}

		// Отправляем структурированное сообщение в новый канал комнаты
		c.Room.Receive <- &ClientMessage{
			Client:  c,
			Message: msg,
		}
	}
}

// WritePump берет сообщения из канала Send и физически отправляет их в сокет
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Комната закрыла канал, значит нужно разорвать соединение
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Если в канале скопилось несколько сообщений, собираем их вместе для оптимизации
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		// Пинг для поддержания активности соединения
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
