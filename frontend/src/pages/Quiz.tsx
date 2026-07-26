import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

type Role = 'organizer' | 'participant';

export const Quiz = () => {
    const { roomCode } = useParams<{ roomCode: string }>();
    const navigate = useNavigate();

    // --- Моковое состояние ---

    const [role] = useState<Role>('participant');
    const [timeLeft, setTimeLeft] = useState(20);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

    // Заглушка текущего вопроса
    const currentQuestion = {
        number: 1,
        text: "Какой тип данных используется для хранения целых чисел в Golang по умолчанию?",
        options: [
            { id: '1', text: 'int', color: 'bg-red-500 hover:bg-red-600' },
            { id: '2', text: 'float64', color: 'bg-blue-500 hover:bg-blue-600' },
            { id: '3', text: 'string', color: 'bg-yellow-500 hover:bg-yellow-600' },
            { id: '4', text: 'boolean', color: 'bg-green-500 hover:bg-green-600' },
        ]
    };

    // --- Эмуляция таймера ---
    useEffect(() => {
        if (timeLeft > 0) {
            const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timerId);
        }
    }, [timeLeft]);

    // --- Обработчики ---
    const handleAnswer = (optionId: string) => {
        // Разрешаем ответить только один раз и если время не вышло
        if (!selectedOption && timeLeft > 0) {
            setSelectedOption(optionId);
            console.log(`Отправка по WebSocket: Ответ ${optionId}`);
        }
    };

    const handleNextQuestion = () => {
        alert('Переход к следующему вопросу (или таблице результатов)');
        navigate('/dashboard'); // Пока просто возвращаем в кабинет
    };

    return (
        <div className="flex min-h-screen flex-col bg-gray-50 font-sans">

            {/* Верхний бар с таймером и информацией */}
            <header className="flex items-center justify-between bg-white px-8 py-4 shadow-sm">
                <div className="text-gray-500 font-medium">
                    Комната: <span className="font-bold text-gray-900">{roomCode}</span>
                </div>

                {/* Таймер */}
                <div className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white shadow-md transition-colors ${timeLeft <= 5 ? 'bg-red-500 animate-pulse' : 'bg-indigo-600'}`}>
                    {timeLeft}
                </div>

                <div className="text-gray-500 font-medium">
                    Вопрос {currentQuestion.number}
                </div>
            </header>

            {/* Основная зона с вопросом */}
            <main className="flex flex-1 flex-col p-8">

                {/* Текст вопроса */}
                <div className="mb-12 flex flex-1 items-center justify-center rounded-2xl bg-white p-8 shadow-sm text-center">
                    <h1 className="text-3xl md:text-5xl font-bold text-gray-800 leading-tight">
                        {currentQuestion.text}
                    </h1>
                </div>

                {/* Зона ответов / управления */}
                {role === 'participant' ? (
                    /* Интерфейс участника: Кнопки ответов */
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 flex-1 max-h-[40vh]">
                        {currentQuestion.options.map((opt) => {
                            // Логика подсветки выбранного ответа
                            const isSelected = selectedOption === opt.id;
                            const isFaded = selectedOption !== null && !isSelected;

                            return (
                                <button
                                    key={opt.id}
                                    onClick={() => handleAnswer(opt.id)}
                                    disabled={selectedOption !== null || timeLeft === 0}
                                    className={`flex items-center justify-center rounded-2xl p-6 text-2xl font-bold text-white shadow-sm transition-all duration-200 
                    ${opt.color} 
                    ${isFaded ? 'opacity-40 grayscale transform scale-95' : ''}
                    ${isSelected ? 'ring-8 ring-white ring-opacity-50 transform scale-105 shadow-xl' : ''}
                    ${selectedOption === null && timeLeft > 0 ? 'active:scale-95' : 'cursor-default'}
                  `}
                                >
                                    {opt.text}
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    /* Интерфейс организатора: Статистика и управление */
                    <div className="flex flex-col items-center justify-center space-y-6 flex-1">
                        <div className="text-xl text-gray-600">
                            Ожидаем ответы участников...
                        </div>
                        {timeLeft === 0 && (
                            <button
                                onClick={handleNextQuestion}
                                className="rounded-full bg-indigo-600 px-12 py-4 text-xl font-bold text-white shadow-lg hover:bg-indigo-700 transition-transform hover:-translate-y-1"
                            >
                                Следующий вопрос
                            </button>
                        )}
                    </div>
                )}
            </main>

        </div>
    );
};