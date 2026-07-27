import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

type Role = 'organizer' | 'participant';

interface Quiz {
    id: string;
    title: string;
    // Бэкенд может не возвращать количество вопросов сразу (если мы не делали Preload), 
    // поэтому пока сделаем это поле необязательным
    questionsCount?: number; 
}

export const Dashboard = () => {
    const [role] = useState<Role>((localStorage.getItem('role') as Role) || 'participant'); 
    const [roomCode, setRoomCode] = useState('');
    
    // Состояния для квизов, загрузки и ошибок API
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingQuizzes, setIsFetchingQuizzes] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const navigate = useNavigate();

    // --- Загрузка реальных квизов с бэкенда ---
    useEffect(() => {
        if (role === 'organizer') {
            const fetchQuizzes = async () => {
                setIsFetchingQuizzes(true);
                try {
                    const token = localStorage.getItem('token');
                    const response = await fetch('http://localhost:8080/api/v1/quizzes/', {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (!response.ok) throw new Error('Не удалось загрузить список квизов');
                    
                    const data = await response.json();
                    
                    // Адаптируем данные под наш интерфейс
                    const formattedQuizzes = data.map((q: any) => ({
                        id: q.ID || q.id,
                        title: q.title,
                        questionsCount: q.questions ? q.questions.length : 0 
                    }));
                    
                    setQuizzes(formattedQuizzes);
                } catch (err: any) {
                    console.error(err);
                    setError(err.message);
                } finally {
                    setIsFetchingQuizzes(false);
                }
            };

            fetchQuizzes();
        }
    }, [role]);

    const handleJoinRoom = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (roomCode.trim().length > 0) {
            navigate(`/lobby/${roomCode}?role=participant`);
        }
    };

    const handleCreateQuiz = () => {
        navigate('/create-quiz');
    };

    const handleCreateRoom = async (quizId: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:8080/api/v1/ws/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // Не забываем токен и тут!
                },
                body: JSON.stringify({ quiz_id: quizId }),
            });

            if (!response.ok) {
                throw new Error('Ошибка при создании комнаты');
            }

            const data = await response.json();
            
            if (data.room_code) {
                navigate(`/lobby/${data.room_code}?role=organizer`);
            }
        } catch (err) {
            console.error(err);
            setError('Не удалось запустить игру. Проверьте подключение к серверу.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8 font-sans">
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
                        onClick={handleLogout}
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

                    {/* Правая колонка: Список реальных квизов */}
                    <section className="flex flex-col rounded-xl bg-white p-6 shadow-sm">
                        <h2 className="mb-4 text-xl font-semibold">
                            {role === 'organizer' ? 'Мои квизы' : 'История участия'}
                        </h2>
                        
                        {role === 'organizer' ? (
                            <div className="flex flex-col gap-4">
                                {error && (
                                    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                                        {error}
                                    </div>
                                )}
                                
                                {isFetchingQuizzes ? (
                                    <div className="flex justify-center p-8 text-gray-400">
                                        Загрузка квизов...
                                    </div>
                                ) : quizzes.length > 0 ? (
                                    quizzes.map((quiz) => (
                                        <div key={quiz.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-4 transition-colors hover:border-indigo-100 hover:bg-indigo-50/30">
                                            <div>
                                                <h3 className="font-semibold text-gray-800">{quiz.title}</h3>
                                                {/* Если бэкенд отдает вопросы, покажем их количество */}
                                                {quiz.questionsCount !== undefined && quiz.questionsCount > 0 && (
                                                    <p className="text-sm text-gray-500">{quiz.questionsCount} вопросов</p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleCreateRoom(quiz.id)}
                                                disabled={isLoading}
                                                className="rounded-lg bg-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-200 transition-colors disabled:opacity-50"
                                            >
                                                {isLoading ? 'Запуск...' : 'Начать игру'}
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex h-32 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 text-gray-500 text-sm">
                                        <p>У вас еще нет созданных квизов.</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 text-gray-500 min-h-[160px]">
                                <svg className="mb-2 h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                                <p>Пока здесь пусто</p>
                            </div>
                        )}
                    </section>

                </div>
            </div>
        </div>
    );
};