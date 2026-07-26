package ws

import (
	"sync"
)

// Manager управляет всеми активными игровыми комнатами
type Manager struct {
	rooms        map[string]*Room
	sync.RWMutex // Мьютекс для защиты map от race conditions (когда несколько юзеров одновременно создают комнаты)
}

// NewManager создает новый экземпляр менеджера
func NewManager() *Manager {
	return &Manager{
		rooms: make(map[string]*Room),
	}
}

// CreateRoom создает новую комнату и добавляет ее в map
func (m *Manager) CreateRoom(roomCode string, quizID string) *Room {
	m.Lock()
	defer m.Unlock()

	room := NewRoom(roomCode, quizID, m)
	m.rooms[roomCode] = room

	// Запускаем игровой цикл комнаты в отдельной горутине
	go room.Run()

	return room
}

// GetRoom возвращает комнату по коду
func (m *Manager) GetRoom(roomCode string) (*Room, bool) {
	m.RLock()
	defer m.RUnlock()
	room, exists := m.rooms[roomCode]
	return room, exists
}

// RemoveRoom удаляет комнату после завершения игры
func (m *Manager) RemoveRoom(roomCode string) {
	m.Lock()
	defer m.Unlock()
	delete(m.rooms, roomCode)
}
