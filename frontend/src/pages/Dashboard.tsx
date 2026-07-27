import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

type Role = 'organizer' | 'participant';

interface Quiz {
    id: string;
    title: string;
    questionsCount?: number; 
}

interface HistoryItem {
    quiz_title: string;
    score: number;
    place: number;
    played_at: string;
}

interface OrganizerHistoryItem {
    quiz_title: string;
    room_code: string;
    played_at: string;
}

export const Dashboard = () => {
    const [role] = useState<Role>((localStorage.getItem('role') as Role) || 'participant'); 
    const [roomCode, setRoomCode] = useState('');
    
    const [activeRoomCode] = useState<string | null>(localStorage.getItem('currentRoomCode'));
    
    // Состояния данных
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [organizerHistory, setOrganizerHistory] = useState<OrganizerHistoryItem[]>([]);
    
    // Переключатель вкладок
    const [activeTab, setActiveTab] = useState<'quizzes' | 'history'>('quizzes');
    
    // Состояния загрузки и ошибок API
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingData, setIsFetchingData] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const navigate = useNavigate();

    // --- Загрузка данных с бэкенда в зависимости от роли ---
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        setIsFetchingData(true);

        if (role === 'organizer') {
            // Загружаем сразу и квизы, и историю сессий
            const fetchOrganizerData = async () => {
                try {
                    const [quizzesRes, historyRes] = await Promise.all([
                        fetch('http://localhost:8080/api/v1/quizzes/', {
                            headers: { 'Authorization': `Bearer ${token}` }
                        }),
                        fetch('http://localhost:8080/api/v1/quizzes/organizer-history', {
                            headers: { 'Authorization': `Bearer ${token}` }
                        })
                    ]);

                    if (!quizzesRes.ok) throw new Error('Не удалось загрузить список квизов');
                    
                    const quizzesData = await quizzesRes.json();
                    setQuizzes(quizzesData.map((q: any) => ({
                        id: q.ID || q.id,
                        title: q.title,
                        questionsCount: q.questions ? q.questions.length : 0 
                    })));

                    if (historyRes.ok) {
                        const historyData = await historyRes.json();
                        setOrganizerHistory(historyData || []);
                    }
                } catch (err: any) {
                    setError(err.message);
                } finally {
                    setIsFetchingData(false);
                }
            };
            fetchOrganizerData();
        } else {
            // Загрузка истории для участника
            const fetchHistory = async () => {
                try {
                    const response = await fetch('http://localhost:8080/api/v1/quizzes/history', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (!response.ok) throw new Error('Не удалось загрузить историю');
                    
                    const data = await response.json();
                    setHistory(data || []);
                } catch (err: any) {
                    setError(err.message);
                } finally {
                    setIsFetchingData(false);
                }
            };
            fetchHistory();
        }
    }, [role]);

    const handleJoinRoom = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (roomCode.trim().length > 0) {
            // Запоминаем код комнаты при входе
            localStorage.setItem('currentRoomCode', roomCode);
            navigate(`/lobby/${roomCode}?role=${role}`);
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
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ quiz_id: quizId }),
            });

            if (!response.ok) {
                throw new Error('Ошибка при создании комнаты');
            }

            const data = await response.json();
            
            if (data.room_code) {
                // Запоминаем код комнаты при создании
                localStorage.setItem('currentRoomCode', data.room_code);
                navigate(`/lobby/${data.room_code}?role=organizer`);
            }
        } catch (err) {
            console.error(err);
            setError('Не удалось запустить игру. Проверьте подключение к серверу.');
        } finally {
            setIsLoading(false);
        }
    };

    // --- НОВОЕ: Обработчик для кнопки "Перейти" в активную игру ---
    const handleResumeGame = () => {
        if (activeRoomCode) {
            navigate(`/lobby/${activeRoomCode}?role=${role}`);
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8 font-sans">
            <div className="mx-auto max-w-5xl">

                <header className="mb-8 flex items-center justify-between rounded-xl bg-white p-6 shadow-sm">
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

                {/* --- НОВОЕ: Плашка активной игры, если она есть --- */}
                {activeRoomCode && (
                    <div className="mb-8 flex items-center justify-between rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white shadow-lg">
                        <div>
                            <h2 className="text-2xl font-bold">У вас есть активная игра!</h2>
                            <p className="mt-1 opacity-90 text-indigo-100">
                                Код комнаты: <span className="font-mono font-bold text-white text-lg tracking-wider">{activeRoomCode}</span>
                            </p>
                        </div>
                        <button
                            onClick={handleResumeGame}
                            className="rounded-xl bg-white px-8 py-3 text-lg font-bold text-indigo-600 shadow-sm transition-transform hover:scale-105 hover:bg-gray-50 hover:shadow-md"
                        >
                            Перейти →
                        </button>
                    </div>
                )}

                <div className="grid gap-8 md:grid-cols-2">

                    <section className="flex flex-col gap-8 rounded-xl bg-white p-6 shadow-sm">
                        
                        {role === 'organizer' && (
                            <div className="border-b border-gray-100 pb-8">
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
                        )}

                        <div>
                            <h2 className="mb-4 text-xl font-semibold">
                                Подключиться вручную
                            </h2>
                            <p className="mb-6 text-gray-600">
                                Введите 6-значный код комнаты, чтобы присоединиться к другой игре.
                            </p>
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
                        
                    </section>

                    {/* Правая колонка: Список квизов или история */}
                    <section className="flex flex-col rounded-xl bg-white p-6 shadow-sm">
                        
                        {error && (
                            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                                {error}
                            </div>
                        )}

                        {isFetchingData ? (
                            <div className="flex justify-center p-8 text-gray-400">
                                Загрузка данных...
                            </div>
                        ) : role === 'organizer' ? (
                            /* --- БЛОК ОРГАНИЗАТОРА --- */
                            <div className="flex flex-col">
                                {/* Вкладки */}
                                <div className="mb-6 flex gap-6 border-b border-gray-200">
                                    <button 
                                        onClick={() => setActiveTab('quizzes')}
                                        className={`pb-3 text-lg font-semibold transition-colors border-b-2 ${activeTab === 'quizzes' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Мои квизы
                                    </button>
                                    <button 
                                        onClick={() => setActiveTab('history')}
                                        className={`pb-3 text-lg font-semibold transition-colors border-b-2 ${activeTab === 'history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Проведенные игры
                                    </button>
                                </div>
                                
                                {/* Контент вкладок */}
                                {activeTab === 'quizzes' ? (
                                    <div className="flex flex-col gap-4">
                                        {quizzes.length > 0 ? (
                                            quizzes.map((quiz) => (
                                                <div key={quiz.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-4 transition-colors hover:border-indigo-100 hover:bg-indigo-50/30">
                                                    <div>
                                                        <h3 className="font-semibold text-gray-800">{quiz.title}</h3>
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
                                    <div className="flex flex-col gap-4">
                                        {organizerHistory.length > 0 ? (
                                            organizerHistory.map((item, idx) => (
                                                <div key={idx} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-4 transition-colors hover:border-indigo-100 hover:bg-indigo-50/30 shadow-sm">
                                                    <div>
                                                        <h3 className="font-semibold text-gray-800 text-lg">{item.quiz_title}</h3>
                                                        <p className="text-sm text-gray-500">{item.played_at}</p>
                                                    </div>
                                                    <button 
                                                        onClick={() => navigate(`/report/${item.room_code}`)}
                                                        className="rounded-lg bg-indigo-100 px-6 py-2 font-medium text-indigo-700 border border-indigo-200 shadow-sm hover:bg-indigo-600 hover:text-white transition-all transform hover:-translate-y-0.5"
                                                    >
                                                        Посмотреть отчет →
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex h-32 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 text-gray-500 text-sm">
                                                <p>Вы еще не провели ни одной игры.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* --- БЛОК УЧАСТНИКА (История) --- */
                            <div className="flex flex-col">
                                <h2 className="mb-6 text-xl font-semibold border-b border-gray-200 pb-3 text-indigo-600">История участия</h2>
                                <div className="flex flex-col gap-4">
                                    {history.length > 0 ? (
                                        history.map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-4 transition-colors hover:border-indigo-100 hover:bg-indigo-50/30 shadow-sm">
                                                <div>
                                                    <h3 className="font-semibold text-gray-800 text-lg">{item.quiz_title}</h3>
                                                    <p className="text-sm text-gray-500">{item.played_at}</p>
                                                </div>
                                                
                                                <div className="flex items-center gap-6">
                                                    {/* Место */}
                                                    <div className="flex flex-col items-center justify-center">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Место</span>
                                                        <span className={`text-2xl font-extrabold ${item.place === 1 ? 'text-yellow-500 drop-shadow-sm' : item.place === 2 ? 'text-gray-400 drop-shadow-sm' : item.place === 3 ? 'text-orange-500 drop-shadow-sm' : 'text-gray-600'}`}>
                                                            {item.place === 1 ? '🥇 1' : item.place === 2 ? '🥈 2' : item.place === 3 ? '🥉 3' : `#${item.place}`}
                                                        </span>
                                                    </div>

                                                    {/* Баллы */}
                                                    <div className="flex min-w-[100px] flex-col items-center justify-center rounded-xl bg-green-100 px-4 py-2 text-green-700 border border-green-200 shadow-sm">
                                                        <span className="text-xl font-black leading-none">{item.score}</span>
                                                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 mt-1">баллов</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 text-gray-500 min-h-[160px]">
                                            <svg className="mb-2 h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                                            <p>Вы еще не играли ни в один квиз</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>

                </div>
            </div>
        </div>
    );
};