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
    options: Option[];
}

export const CreateQuiz = () => {
    const navigate = useNavigate();
    const [title, setTitle] = useState('');
    const [questions, setQuestions] = useState<Question[]>([
        {
            id: '1',
            text: '',
            type: 'single_choice',
            timeLimit: 30,
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

    const handleSave = () => {
        console.log('Отправка на бэкенд:', { title, questions });
        alert('Квиз сохранен!');
        navigate('/dashboard');
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8 pb-24">
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
                        className="rounded-lg bg-indigo-600 px-6 py-2 text-white font-medium hover:bg-indigo-700 transition-colors"
                    >
                        Сохранить квиз
                    </button>
                </header>

                <section className="mb-8 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                    <label className="mb-1 block text-sm font-medium text-gray-700">Название квиза</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Например: Основы Golang"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                </section>

                <div className="space-y-6">
                    {questions.map((q, index) => (
                        <div key={q.id} className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">

                            <div className="mb-4 flex items-center justify-between border-b pb-4">
                                <h3 className="text-lg font-semibold">Вопрос {index + 1}</h3>
                                <select
                                    value={q.type}
                                    onChange={(e) => handleQuestionChange(q.id, 'type', e.target.value)}
                                    className="rounded-md border border-gray-300 p-1 text-sm focus:border-indigo-500 focus:outline-none"
                                >
                                    <option value="single_choice">Один ответ</option>
                                    <option value="multiple_choice">Несколько ответов</option>
                                    <option value="text">Текстовый ввод</option>
                                </select>
                            </div>

                            <input
                                type="text"
                                value={q.text}
                                onChange={(e) => handleQuestionChange(q.id, 'text', e.target.value)}
                                placeholder="Введите текст вопроса..."
                                className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-2 font-medium focus:border-indigo-500 focus:outline-none"
                            />

                            {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                                <div className="space-y-2">
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