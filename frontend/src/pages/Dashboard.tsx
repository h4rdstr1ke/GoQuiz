import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Временный тип
type Role = 'organizer' | 'participant';

export const Dashboard = () => {
    const [role] = useState<Role>('organizer'); // participant - втор роль
    const [roomCode, setRoomCode] = useState('');
    const navigate = useNavigate();

    const handleJoinRoom = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (roomCode.trim().length > 0) {
            navigate(`/lobby/${roomCode}`);
        }
    };

    const handleCreateQuiz = () => {
        navigate('/create-quiz');
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="mx-auto max-w-5xl">

                {/* Шапка */}
                <header className="mb-10 flex items-center justify-between rounded-xl bg-white p-6 shadow-sm">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Личный кабинет</h1>
                        <p className="text-gray-500">
                            Вы вошли как: <span className="font-semibold text-indigo-600">{role === 'organizer' ? 'Организатор' : 'Участник'}</span>
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/login')}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        Выйти
                    </button>
                </header>

                {/* Основной контент */}
                <div className="grid gap-8 md:grid-cols-2">

                    {/* Левая колонка: Основное действие */}
                    <section className="rounded-xl bg-white p-6 shadow-sm">
                        {role === 'organizer' ? (
                            <div>
                                <h2 className="mb-4 text-xl font-semibold">Управление квизами</h2>
                                <p className="mb-6 text-gray-600">Создавайте новые игры и управляйте уже существующими.</p>
                                <button
                                    onClick={handleCreateQuiz}
                                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-white font-medium hover:bg-indigo-700 transition-colors"
                                >
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                    Создать новый квиз
                                </button>
                            </div>
                        ) : (
                            <div>
                                <h2 className="mb-4 text-xl font-semibold">Подключиться к игре</h2>
                                <p className="mb-6 text-gray-600">Введите 6-значный код комнаты, который выдал организатор.</p>
                                <form onSubmit={handleJoinRoom} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={roomCode}
                                        onChange={(e) => setRoomCode(e.target.value)}
                                        placeholder="Например: 839402"
                                        className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-lg font-mono focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                    />
                                    <button
                                        type="submit"
                                        className="rounded-lg bg-green-600 px-6 py-3 text-white font-medium hover:bg-green-700 transition-colors"
                                    >
                                        Войти
                                    </button>
                                </form>
                            </div>
                        )}
                    </section>

                    {/* Правая колонка: История (Заглушка) */}
                    <section className="rounded-xl bg-white p-6 shadow-sm">
                        <h2 className="mb-4 text-xl font-semibold">
                            {role === 'organizer' ? 'Мои квизы' : 'История участия'}
                        </h2>
                        <div className="flex h-40 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 text-gray-500">
                            <svg className="mb-2 h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                            <p>Пока здесь пусто</p>
                        </div>
                    </section>

                </div>
            </div>
        </div>
    );
};