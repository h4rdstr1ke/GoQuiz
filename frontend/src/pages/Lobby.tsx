import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

type Role = 'organizer' | 'participant';

interface Player {
    id: string;
    name: string;
}

export const Lobby = () => {
    const { roomCode } = useParams<{ roomCode: string }>();
    const navigate = useNavigate();

    // Временно
    // TODO webSocket
    const [role] = useState<Role>('participant');
    const [players] = useState<Player[]>([
        { id: '1', name: 'Иван Иванов' },
        { id: '2', name: 'Alex' },
        { id: '3', name: 'Гость_773' },
    ]);

    const handleStartGame = () => {
        navigate(`/quiz/${roomCode}`);
    };

    return (
        <div className="flex min-h-screen flex-col bg-indigo-50 p-6 font-sans">

            {/* Верхний бар */}
            <header className="flex w-full items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                >
                    ← Назад
                </button>
                <div className="text-center">
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Код комнаты</p>
                    <h1 className="text-4xl font-extrabold text-indigo-700 tracking-widest">{roomCode}</h1>
                </div>
                <div className="w-20"></div> {/* Пустой div для центрирования кода комнаты */}
            </header>

            {/* Основная зона с игроками */}
            <main className="mx-auto mt-8 flex w-full max-w-5xl flex-1 flex-col items-center">

                <div className="mb-8 text-center">
                    <h2 className="text-2xl font-bold text-gray-800">
                        Ожидание игроков...
                    </h2>
                    <p className="mt-2 text-gray-600">
                        Подключилось: <span className="font-bold text-indigo-600">{players.length}</span>
                    </p>
                </div>

                {/* Сетка игроков */}
                <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {players.map((player) => (
                        <div
                            key={player.id}
                            className="flex flex-col items-center justify-center rounded-xl bg-white p-4 shadow-sm animate-fade-in-up"
                        >
                            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-600">
                                {player.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="max-w-full truncate text-sm font-medium text-gray-700">
                                {player.name}
                            </span>
                        </div>
                    ))}
                </div>

            </main>

            {/* Подвал с кнопкой старта (только для организатора) */}
            <footer className="mt-auto flex justify-center py-6">
                {role === 'organizer' ? (
                    <button
                        onClick={handleStartGame}
                        className="rounded-full bg-indigo-600 px-12 py-4 text-lg font-bold text-white shadow-lg hover:bg-indigo-700 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-indigo-300 transition-all transform hover:-translate-y-1"
                    >
                        Начать игру
                    </button>
                ) : (
                    <div className="flex items-center gap-3 rounded-full bg-white px-8 py-4 shadow-sm text-gray-600">
                        <svg className="h-6 w-6 animate-spin text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="font-medium">Ожидаем запуска организатором...</span>
                    </div>
                )}
            </footer>

        </div>
    );
};