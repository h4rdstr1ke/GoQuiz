import React, { createContext, useContext, useRef, useState, useCallback } from 'react';

// Типы событий
export type EventType = 
  | 'players_list' 
  | 'player_joined' 
  | 'game_started' 
  | 'question_show' 
  | 'answer_result' 
  | 'game_completed' 
  | 'submit_answer'
  | 'next_question'
  | 'leaderboard_update'
  | 'player_answered' 
  | 'error';

export interface WsMessage {
  type: EventType;
  payload?: any;
}

interface WebSocketContextType {
  connect: (roomCode: string, username: string, role: string) => void;
  disconnect: () => void;
  sendMessage: (type: EventType, payload?: any) => void;
  lastMessage: WsMessage | null;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const ws = useRef<WebSocket | null>(null);

  const connect = useCallback((roomCode: string, username: string, role: string) => {

    // Предотвращаем множественные подключения (учитывая процесс коннекта и Strict Mode в React)
    if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) {
        return;
    }

    // Формируем URL для подключения (TODO из .env)
    const url = `ws://localhost:8080/api/v1/ws/join/${roomCode}?username=${encodeURIComponent(username)}&role=${role}`;
    
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      console.log('WebSocket соединение установлено');
      setIsConnected(true);
    };

    ws.current.onmessage = (event) => {
      try {
        const message: WsMessage = JSON.parse(event.data);
        console.log('Получено сообщение:', message);
        setLastMessage(message);
      } catch (error) {
        console.error('Ошибка парсинга сообщения:', error);
      }
    };

    ws.current.onclose = () => {
      console.log('WebSocket соединение закрыто');
      setIsConnected(false);
      ws.current = null;
    };

    ws.current.onerror = (error) => {
      console.error('Ошибка WebSocket:', error);
    };
  }, []);

  const disconnect = useCallback(() => {
    if (ws.current) {
      ws.current.close();
    }
  }, []);

  const sendMessage = useCallback((type: EventType, payload?: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const message: WsMessage = { type, payload };
      ws.current.send(JSON.stringify(message));
    } else {
      console.error('Невозможно отправить сообщение: сокет закрыт');
    }
  }, []);

  return (
    <WebSocketContext.Provider value={{ connect, disconnect, sendMessage, lastMessage, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
};

// Кастомный хук для удобного использования контекста
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket должен использоваться внутри WebSocketProvider');
  }
  return context;
};