import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

export const Login = () => {
    const [isLogin, setIsLogin] = useState(true);
    const navigate = useNavigate();

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // TODO запрос к бэку
        navigate('/dashboard');
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">

                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-extrabold text-gray-900">GoQuiz</h1>
                    <p className="mt-2 text-gray-500">
                        {isLogin ? 'Войдите в свой аккаунт' : 'Создайте новый аккаунт'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">

                    {!isLogin && (
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">Имя пользователя</label>
                            <input
                                type="text"
                                required
                                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                placeholder="Например: Player1"
                            />
                        </div>
                    )}

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            placeholder="you@example.com"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Пароль</label>
                        <input
                            type="password"
                            required
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            placeholder="••••••••"
                        />
                    </div>

                    {!isLogin && (
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">Кто вы?</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2">
                                    <input type="radio" name="role" value="participant" defaultChecked className="text-indigo-600 focus:ring-indigo-500" />
                                    <span className="text-sm">Участник</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input type="radio" name="role" value="organizer" className="text-indigo-600 focus:ring-indigo-500" />
                                    <span className="text-sm">Организатор</span>
                                </label>
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition-colors"
                    >
                        {isLogin ? 'Войти' : 'Зарегистрироваться'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-600">
                    {isLogin ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="font-semibold text-indigo-600 hover:text-indigo-500 hover:underline"
                    >
                        {isLogin ? 'Создать' : 'Войти'}
                    </button>
                </div>

            </div>
        </div>
    );
};