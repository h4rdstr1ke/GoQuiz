import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useWebSocket } from '../context/WebSocketContext';

type Role = 'organizer' | 'participant';

interface Option {
    id: string;
    text: string;
    color: string;
}

interface Question {
    number: number;
    text: string;
    type: 'single_choice' | 'multiple_choice' | 'text';
    imageUrl?: string; // Ссылка на изображение
    options: Option[];
}

interface AnswerResult {
    is_correct: boolean;
    score: number;
}

const COLORS = [
    'bg-red-500 hover:bg-red-600',
    'bg-blue-500 hover:bg-blue-600',
    'bg-yellow-500 hover:bg-yellow-600',
    'bg-green-500 hover:bg-green-600',
    'bg-purple-500 hover:bg-purple-600',
    'bg-pink-500 hover:bg-pink-600',
];

export const Quiz = () => {
    const { roomCode } = useParams<{ roomCode: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    
    // Подключаем сокеты
    const { sendMessage, lastMessage } = useWebSocket();

    const roleParam = searchParams.get('role') as Role | null;
    const role: Role = roleParam || 'participant';

    const [timeLeft, setTimeLeft] = useState(0);
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [questionNumber, setQuestionNumber] = useState(0);

    // Новые стейты для разных типов ответов
    const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
    const [textAnswer, setTextAnswer] = useState<string>('');
    const [hasAnswered, setHasAnswered] = useState(false);

    const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
    const [leaderboard, setLeaderboard] = useState<Record<string, number>>({});
    const [isGameCompleted, setIsGameCompleted] = useState(false);

    const [answeredPlayers, setAnsweredPlayers] = useState<string[]>([]);
    const [totalParticipants, setTotalParticipants] = useState(0);

    // --- Обработка сообщений от сервера ---
    useEffect(() => {
        if (!lastMessage) return;

        switch (lastMessage.type) {
            case 'question_show':
            case 'game_state': {
                const payload = lastMessage.payload;
                
                const optionsWithColors: Option[] = (payload.options || []).map((opt: any, index: number) => ({
                    id: opt.id,
                    text: opt.text,
                    color: COLORS[index % COLORS.length]
                }));

                const qIdx = payload.question_index !== undefined ? payload.question_index : questionNumber;

                setQuestionNumber(qIdx);
                setCurrentQuestion({
                    number: qIdx + 1, 
                    text: payload.question_text,
                    type: payload.type || 'single_choice',
                    imageUrl: payload.image_url,
                    options: optionsWithColors
                });
                
                if (lastMessage.type === 'game_state') {
                    // Моментальное восстановление сессии при переподключении
                    setTimeLeft(payload.time_limit || 0); 
                    setHasAnswered(payload.has_answered || false);
                    if (payload.leaderboard) setLeaderboard(payload.leaderboard);
                    if (payload.answered_players) setAnsweredPlayers(payload.answered_players);
                } else {
                    setTimeLeft(payload.time_limit || 20); 
                    setHasAnswered(false);
                    setAnsweredPlayers([]);
                }
                
                // Сбрасываем выбранный ответ и результат прошлого вопроса
                setSelectedOptions([]);
                setTextAnswer('');
                setAnswerResult(null);   
                setTotalParticipants(payload.total_participants || 0);
                break;
            }

            case 'player_answered':
                const { username, leaderboard: newLeaderboard } = lastMessage.payload;
                
                setAnsweredPlayers(prev => !prev.includes(username) ? [...prev, username] : prev);

                if (newLeaderboard) {
                    setLeaderboard(newLeaderboard);
                }
                break;

            case 'answer_result':
                // Сохраняем личный результат, полученный от сервера
                setAnswerResult(lastMessage.payload);
                break;

            case 'leaderboard_update':
                // Обновляем таблицу баллов (оставили для других случаев, например при старте/реконнекте)
                setLeaderboard(lastMessage.payload);
                break;

            case 'game_completed':
                // Очищаем активную комнату из памяти, так как игра завершилась
                localStorage.removeItem('currentRoomCode');

                // Переход на финальную таблицу лидеров
                if (lastMessage.payload) {
                    setLeaderboard(lastMessage.payload);
                }
                setIsGameCompleted(true);
                break;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastMessage, navigate]);

    // --- Эмуляция таймера ---
    useEffect(() => {
        if (timeLeft > 0) {
            const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timerId);
        } else if (timeLeft === 0 && !hasAnswered && currentQuestion && role === 'participant') {
            // Если время вышло, а ответа нет - отправляем пустой, чтобы сервер засчитал 0
            handleFinalSubmit();
        }
    }, [timeLeft]);

    // --- Обработчики ---
    const handleOptionToggle = (optionId: string) => {
        if (hasAnswered || timeLeft === 0) return;
        
        if (currentQuestion?.type === 'single_choice') {
            setSelectedOptions([optionId]);
            // Одиночный выбор отправляем сразу
            sendMessage('submit_answer', { answer_ids: [optionId] });
            setHasAnswered(true);
        } else if (currentQuestion?.type === 'multiple_choice') {
            setSelectedOptions(prev => 
                prev.includes(optionId) ? prev.filter(id => id !== optionId) : [...prev, optionId]
            );
        }
    };

    const handleFinalSubmit = () => {
        if (hasAnswered) return;
        
        setHasAnswered(true);
        if (currentQuestion?.type === 'text') {
            sendMessage('submit_answer', { answer_text: textAnswer });
        } else {
            sendMessage('submit_answer', { answer_ids: selectedOptions });
        }
    };

    const handleNextQuestion = () => {
        sendMessage('next_question');
    };

    // Заглушка, пока сервер не прислал первый вопрос
    if (!currentQuestion) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 text-2xl font-bold text-gray-400">
                Загрузка вопроса...
            </div>
        );
    }

    // Сортируем таблицу лидеров по убыванию баллов
    const sortedLeaderboard = Object.entries(leaderboard).sort((a, b) => b[1] - a[1]);

    // --- ФИНАЛЬНЫЙ ЭКРАН ---
    if (isGameCompleted) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-indigo-900 font-sans p-6">
                <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-10 text-center animate-fade-in-up">
                    <h1 className="text-5xl font-extrabold text-gray-900 mb-4">🏁 Квиз завершен!</h1>
                    <p className="text-xl text-gray-500 mb-10">Итоговая таблица результатов</p>
                    
                    <div className="space-y-4 mb-10">
                        {sortedLeaderboard.length > 0 ? (
                            sortedLeaderboard.map(([name, score], index) => (
                                <div key={name} className={`flex items-center justify-between p-5 rounded-2xl border-2 ${index === 0 ? 'bg-yellow-50 border-yellow-200' : index === 1 ? 'bg-gray-50 border-gray-200' : index === 2 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className="text-4xl">
                                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👏'}
                                        </div>
                                        <span className="font-bold text-gray-800 text-2xl">{name}</span>
                                    </div>
                                    <span className="font-extrabold text-indigo-600 text-3xl">{score}</span>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-400 text-lg">Нет данных о баллах.</p>
                        )}
                    </div>

                    <button
                        onClick={() => navigate('/dashboard')}
                        className="rounded-full bg-indigo-600 px-10 py-4 text-xl font-bold text-white shadow-lg hover:bg-indigo-700 transition-all transform hover:-translate-y-1"
                    >
                        Вернуться в меню
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-gray-50 font-sans">

            {/* Верхний бар с таймером и информацией */}
            <header className="flex items-center justify-between bg-white px-8 py-4 shadow-sm">
                <div className="text-gray-500 font-medium">
                    Комната: <span className="font-bold text-gray-900">{roomCode}</span>
                </div>

                {/* Таймер */}
                <div className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white shadow-md transition-colors ${timeLeft === 0 ? 'bg-gray-400' : timeLeft <= 5 ? 'bg-red-500 animate-pulse' : 'bg-indigo-600'}`}>
                    {timeLeft}
                </div>

                <div className="text-gray-500 font-medium">
                    Вопрос {currentQuestion.number}
                </div>
            </header>

            {/* Основная зона с вопросом */}
            <main className="flex flex-1 flex-col p-8 max-w-4xl w-full mx-auto">

                {/* Текст вопроса и Изображение */}
                <div className="mb-8 flex flex-col items-center justify-center rounded-2xl bg-white p-8 shadow-sm text-center">
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-800 leading-tight mb-4">
                        {currentQuestion.text}
                    </h1>
                    {/* НОВОЕ: Отображение картинки, если она есть */}
                    {currentQuestion.imageUrl && (
                        <img src={currentQuestion.imageUrl} alt="Иллюстрация к вопросу" className="max-h-64 rounded-xl object-contain shadow-md" />
                    )}
                </div>

                {/* Зона ответов / управления */}
                {role === 'participant' ? (
                    /* Интерфейс участника */
                    timeLeft > 0 && !hasAnswered ? (
                        <div className="flex flex-col flex-1">
                            {currentQuestion.type === 'text' ? (
                                <div className="flex flex-col items-center justify-center w-full gap-4 mt-8">
                                    <input 
                                        type="text"
                                        value={textAnswer}
                                        onChange={(e) => setTextAnswer(e.target.value)}
                                        placeholder="Введите ваш ответ..."
                                        className="w-full max-w-lg rounded-xl border-2 border-indigo-200 p-4 text-xl focus:border-indigo-500 focus:outline-none"
                                    />
                                    <button onClick={handleFinalSubmit} className="bg-indigo-600 text-white px-10 py-4 rounded-xl font-bold text-xl hover:bg-indigo-700 shadow-md transition-all">Ответить</button>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 flex-1">
                                        {currentQuestion.options.map((opt) => {
                                            const isSelected = selectedOptions.includes(opt.id);
                                            const isFaded = hasAnswered && !isSelected;

                                            return (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => handleOptionToggle(opt.id)}
                                                    className={`flex items-center justify-center rounded-2xl p-6 text-2xl font-bold text-white shadow-sm transition-all duration-200 
                                                        ${opt.color} 
                                                        ${isFaded ? 'opacity-40 grayscale transform scale-95' : ''}
                                                        ${isSelected ? 'ring-8 ring-white ring-opacity-50 transform scale-105 shadow-xl' : 'active:scale-95'}
                                                    `}
                                                >
                                                    {opt.text}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {currentQuestion.type === 'multiple_choice' && (
                                        <button onClick={handleFinalSubmit} disabled={selectedOptions.length === 0} className="mt-8 mx-auto w-full max-w-sm bg-indigo-600 text-white px-10 py-4 rounded-xl font-bold text-xl hover:bg-indigo-700 disabled:opacity-50 shadow-md">Отправить ответ</button>
                                    )}
                                </>
                            )}
                        </div>
                    ) : (
                        /* Экран результатов после истечения времени */
                        <div className={`flex flex-1 flex-col items-center justify-center rounded-3xl p-8 text-white text-center shadow-lg transform transition-all animate-fade-in-up 
                            ${answerResult?.is_correct ? 'bg-green-500' : answerResult === null ? 'bg-gray-500' : 'bg-red-500'}`}>
                            
                            <div className="text-6xl mb-4">
                                {answerResult?.is_correct ? '🎉' : answerResult === null ? '⏳' : '❌'}
                            </div>
                            <h2 className="text-4xl font-bold mb-2">
                                {answerResult?.is_correct ? 'Правильно!' : answerResult === null ? 'Ответ принят / Время вышло!' : 'Неверно!'}
                            </h2>
                            {answerResult && (
                                <p className="mt-4 text-xl">
                                    Твой счет: <span className="font-bold text-3xl ml-2">{answerResult.score}</span>
                                </p>
                            )}
                            <p className="mt-8 text-lg opacity-80">Ожидаем следующий вопрос...</p>
                        </div>
                    )
                ) : (
                    /* Интерфейс организатора */
                    <div className="flex flex-col items-center flex-1 w-full max-w-2xl mx-auto">
                        {timeLeft > 0 ? (
                            <div className="flex flex-col items-center justify-center w-full flex-1">
                                
                                {/* Отображение вариантов ответов для организатора */}
                                {currentQuestion.type !== 'text' && (
                                    <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 mb-8">
                                        {currentQuestion.options.map((opt) => (
                                            <div
                                                key={opt.id}
                                                className={`flex items-center justify-center rounded-xl p-4 text-lg font-bold text-white shadow-sm opacity-90 ${opt.color}`}
                                            >
                                                {opt.text}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="text-xl text-gray-600 font-medium mb-6">
                                    Ответили: <span className="font-bold text-indigo-600">{answeredPlayers.length}</span> из <span className="font-bold">{totalParticipants}</span>
                                </div>

                                {/* Плашки с именами тех, кто уже ответил */}
                                {answeredPlayers.length > 0 && (
                                    <div className="flex flex-wrap justify-center gap-3 w-full max-w-lg mb-8">
                                        {answeredPlayers.map((name, idx) => (
                                            <div key={idx} className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-xl font-semibold shadow-sm animate-fade-in-up">
                                                <span>✓</span> {name}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="w-full bg-white rounded-2xl shadow-sm p-6 mb-8 animate-fade-in-up">
                                <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Текущие результаты</h2>
                                {sortedLeaderboard.length > 0 ? (
                                    <div className="space-y-3">
                                        {sortedLeaderboard.map(([name, score], index) => (
                                            <div key={name} className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-white ${index === 0 ? 'bg-yellow-400' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                                        {index + 1}
                                                    </div>
                                                    <span className="font-bold text-gray-700 text-lg">{name}</span>
                                                </div>
                                                <span className="font-extrabold text-indigo-600 text-xl">{score}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center text-gray-500">Пока никто не набрал баллы</p>
                                )}
                            </div>
                        )}

                        {/* Кнопка доступна всегда */}
                        <button
                            onClick={handleNextQuestion}
                            className={`mt-auto w-full rounded-2xl py-5 text-xl font-bold text-white shadow-lg transition-transform hover:-translate-y-1 ${
                                timeLeft === 0 
                                ? 'bg-indigo-600 hover:bg-indigo-700' 
                                : 'bg-gray-400 hover:bg-gray-500'
                            }`}
                        >
                            {timeLeft === 0 ? 'Следующий вопрос →' : 'Пропустить таймер'}
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
};