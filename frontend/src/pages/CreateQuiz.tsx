import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type QuestionType = 'single_choice' | 'multiple_choice' | 'text';

interface Option {
    id: string;
    text: string;
    isCorrect: boolean;
}

interface Question {
    id: string;
    text: string;
    type: QuestionType;
    timeLimit: number;
    points: number;
    pointSystem: 'fixed' | 'time'; // Система баллов
    imageUrl: string;              // Ссылка на изображение
    options: Option[];
}

export const CreateQuiz = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    
    // Состояния квиза
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    
    // Состояния вопросов
    const [questions, setQuestions] = useState<Question[]>([
        {
            id: '1',
            text: '',
            type: 'single_choice',
            timeLimit: 30,
            points: 100,
            pointSystem: 'fixed', // По умолчанию фиксированные
            imageUrl: '',
            options: [{ id: '1-1', text: '', isCorrect: false }]
        }
    ]);

    // --- Обработчики добавления ---

    const handleAddQuestion = () => {
        const newId = Date.now().toString();
        setQuestions([
            ...questions,
            {
                id: newId,
                text: '',
                type: 'single_choice',
                timeLimit: 30,
                points: 100,
                pointSystem: 'fixed',
                imageUrl: '',
                options: [{ id: `${newId}-1`, text: '', isCorrect: false }]
            }
        ]);
    };

    const handleAddOption = (questionId: string) => {
        setQuestions(questions.map(q => {
            if (q.id === questionId) {
                return {
                    ...q,
                    options: [...q.options, { id: Date.now().toString(), text: '', isCorrect: false }]
                };
            }
            return q;
        }));
    };

    // --- Обработчики изменения данных ---

    const handleQuestionChange = (questionId: string, field: keyof Question, value: any) => {
        setQuestions(questions.map(q => q.id === questionId ? { ...q, [field]: value } : q));
    };

    const handleOptionTextChange = (questionId: string, optionId: string, text: string) => {
        setQuestions(questions.map(q => {
            if (q.id === questionId) {
                return {
                    ...q,
                    options: q.options.map(o => o.id === optionId ? { ...o, text } : o)
                };
            }
            return q;
        }));
    };

    const handleOptionCorrectToggle = (questionId: string, optionId: string, isChecked: boolean) => {
        setQuestions(questions.map(q => {
            if (q.id === questionId) {
                return {
                    ...q,
                    options: q.options.map(o => {
                        if (o.id === optionId) return { ...o, isCorrect: isChecked };
                        // Если тип "один выбор", сбрасываем галочки у остальных вариантов
                        if (q.type === 'single_choice') return { ...o, isCorrect: false };
                        return o;
                    })
                };
            }
            return q;
        }));
    };

    // --- Интеграция с бэкендом ---

    const handleSave = async () => {
        if (!title.trim()) {
            alert('Пожалуйста, введите название квиза');
            return;
        }

        setIsLoading(true);

        try {
            const token = localStorage.getItem('token');
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };

            const quizPayload = {
                title,
                description,
                category: 'general' 
            };

            const quizRes = await fetch('http://localhost:8080/api/v1/quizzes/', {
                method: 'POST',
                headers,
                body: JSON.stringify(quizPayload)
            });

            if (!quizRes.ok) throw new Error('Ошибка при создании квиза');
            
            const createdQuiz = await quizRes.json();
            const quizId = createdQuiz.id; 

            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                
                // под структуру (AddQuestionInput)
                const questionPayload = {
                    content_text: q.text,
                    image_url: q.imageUrl.trim() !== '' ? q.imageUrl.trim() : null, 
                    type: q.type,
                    point_system: q.pointSystem, 
                    time_limit_seconds: q.timeLimit,
                    points: q.points,
                    sort_order: i + 1,
                    options: q.type !== 'text' ? q.options.map(opt => ({
                        option_text: opt.text,
                        is_correct: opt.isCorrect
                    })) : q.options.map(opt => ({
                        option_text: opt.text,
                        is_correct: true 
                    }))
                };

                const qRes = await fetch(`http://localhost:8080/api/v1/quizzes/${quizId}/questions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(questionPayload)
                });

                if (!qRes.ok) throw new Error(`Ошибка при сохранении вопроса ${i + 1}`);
            }

            alert('Квиз успешно сохранен!');
            navigate('/dashboard');

        } catch (error: any) {
            console.error(error);
            alert(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8 pb-24 font-sans">
            <div className="mx-auto max-w-3xl">

                <header className="mb-8 flex items-center justify-between">
                    <div>
                        <button onClick={() => navigate('/dashboard')} className="mb-2 text-sm text-gray-500 hover:text-gray-800">
                            ← Назад в кабинет
                        </button>
                        <h1 className="text-3xl font-bold text-gray-900">Создание квиза</h1>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={isLoading}
                        className={`rounded-lg px-6 py-2 text-white font-medium transition-colors ${isLoading ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                    >
                        {isLoading ? 'Сохраняем...' : 'Сохранить квиз'}
                    </button>
                </header>

                <section className="mb-8 space-y-4 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Название квиза</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Например: Основы Golang"
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Описание (необязательно)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Краткое описание для студентов..."
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            rows={2}
                        />
                    </div>
                </section>

                <div className="space-y-6">
                    {questions.map((q, index) => (
                        <div key={q.id} className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">

                            <div className="mb-4 flex flex-wrap items-center justify-between border-b pb-4 gap-4">
                                <h3 className="text-lg font-semibold">Вопрос {index + 1}</h3>
                                
                                <div className="flex gap-4 items-center flex-wrap">
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm text-gray-600">Время (сек):</label>
                                        <input
                                            type="number"
                                            value={q.timeLimit}
                                            onChange={(e) => handleQuestionChange(q.id, 'timeLimit', parseInt(e.target.value))}
                                            className="w-16 rounded-md border border-gray-300 p-1 text-sm focus:border-indigo-500 focus:outline-none"
                                        />
                                    </div>
                                    <select
                                        value={q.type}
                                        onChange={(e) => handleQuestionChange(q.id, 'type', e.target.value)}
                                        className="rounded-md border border-gray-300 p-1 text-sm focus:border-indigo-500 focus:outline-none bg-gray-50"
                                    >
                                        <option value="single_choice">Один ответ</option>
                                        <option value="multiple_choice">Несколько ответов</option>
                                        <option value="text">Текстовый ввод</option>
                                    </select>
                                    
                                    {/* Выбор системы баллов */}
                                    <select
                                        value={q.pointSystem}
                                        onChange={(e) => handleQuestionChange(q.id, 'pointSystem', e.target.value)}
                                        className="rounded-md border border-gray-300 p-1 text-sm focus:border-indigo-500 focus:outline-none bg-indigo-50 text-indigo-700 font-medium"
                                    >
                                        <option value="fixed">Фикс. баллы</option>
                                        <option value="time">Баллы от времени</option>
                                    </select>
                                </div>
                            </div>

                            <input
                                type="text"
                                value={q.text}
                                onChange={(e) => handleQuestionChange(q.id, 'text', e.target.value)}
                                placeholder="Введите текст вопроса..."
                                className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-2 font-medium focus:border-indigo-500 focus:outline-none"
                            />
                            
                            {/* Ввод ссылки на картинку */}
                            <div className="mb-6">
                                <input
                                    type="text"
                                    value={q.imageUrl}
                                    onChange={(e) => handleQuestionChange(q.id, 'imageUrl', e.target.value)}
                                    placeholder="Ссылка на изображение (необязательно)..."
                                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 focus:border-indigo-500 focus:outline-none bg-gray-50"
                                />
                                {/* Предпросмотр картинки, если ссылка введена */}
                                {q.imageUrl && (
                                    <div className="mt-2 flex justify-center bg-gray-100 rounded-lg p-2 border border-dashed border-gray-300">
                                        <img 
                                            src={q.imageUrl} 
                                            alt="Предпросмотр" 
                                            className="max-h-32 object-contain rounded"
                                            onError={(e) => (e.currentTarget.style.display = 'none')}
                                            onLoad={(e) => (e.currentTarget.style.display = 'block')}
                                        />
                                    </div>
                                )}
                            </div>

                            {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                                <div className="space-y-2 border-t pt-4 border-gray-100">
                                    {q.options.map((opt) => (
                                        <div key={opt.id} className="flex items-center gap-3">
                                            <input
                                                type={q.type === 'single_choice' ? 'radio' : 'checkbox'}
                                                name={`correct-${q.id}`}
                                                checked={opt.isCorrect}
                                                onChange={(e) => handleOptionCorrectToggle(q.id, opt.id, e.target.checked)}
                                                className="h-5 w-5 text-indigo-600 cursor-pointer"
                                            />
                                            <input
                                                type="text"
                                                value={opt.text}
                                                onChange={(e) => handleOptionTextChange(q.id, opt.id, e.target.value)}
                                                placeholder="Вариант ответа"
                                                className="flex-1 rounded border border-gray-300 px-3 py-1 focus:border-indigo-500 focus:outline-none"
                                            />
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => handleAddOption(q.id)}
                                        className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                                    >
                                        + Добавить вариант
                                    </button>
                                </div>
                            )}

                            {q.type === 'text' && (
                                <div className="border-t pt-4 border-gray-100">
                                    <p className="mb-2 text-sm text-gray-500">Добавьте допустимые варианты правильного ответа (без учета регистра):</p>
                                    {q.options.map((opt) => (
                                        <div key={opt.id} className="flex items-center gap-3 mb-2">
                                            <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">✓</div>
                                            <input
                                                type="text"
                                                value={opt.text}
                                                onChange={(e) => handleOptionTextChange(q.id, opt.id, e.target.value)}
                                                placeholder="Правильный ответ..."
                                                className="flex-1 rounded border border-gray-300 px-3 py-1 focus:border-indigo-500 focus:outline-none"
                                            />
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => handleAddOption(q.id)}
                                        className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                                    >
                                        + Добавить синоним / альтернативный вариант
                                    </button>
                                </div>
                            )}

                        </div>
                    ))}
                </div>

                <button
                    onClick={handleAddQuestion}
                    className="mt-6 w-full rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50 py-4 text-indigo-600 font-semibold hover:bg-indigo-100 hover:border-indigo-300 transition-colors"
                >
                    + Добавить новый вопрос
                </button>

            </div>
        </div>
    );
};