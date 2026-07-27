import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

export const Login = () => {
    const [isLogin, setIsLogin] = useState(true);
    const navigate = useNavigate();

    // Состояния полей формы
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [role, setRole] = useState('participant');
    
    // Состояния загрузки и ошибок
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
        
        const payload = isLogin 
            ? { email, password } 
            : { username, email, password, role };

        try {
            const response = await fetch(`http://localhost:8080${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Произошла ошибка при авторизации');
            }

            
            localStorage.setItem('token', data.token);
            
            localStorage.setItem('role', data.user.role);
            localStorage.setItem('username', data.user.username);

            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 font-sans">
            <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">

                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-extrabold text-gray-900">GoQuiz</h1>
                    <p className="mt-2 text-gray-500">
                        {isLogin ? 'Войдите в свой аккаунт' : 'Создайте новый аккаунт'}
                    </p>
                </div>

                {/* Блок вывода ошибки сервера */}
                {error && (
                    <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-100">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">

                    {!isLogin && (
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">Имя пользователя</label>
                            <input
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
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
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            placeholder="you@example.com"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Пароль</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            placeholder="••••••••"
                        />
                    </div>

                    {!isLogin && (
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">Кто вы?</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="role" 
                                        value="participant" 
                                        checked={role === 'participant'}
                                        onChange={(e) => setRole(e.target.value)}
                                        className="text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4" 
                                    />
                                    <span className="text-sm">Участник</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="role" 
                                        value="organizer" 
                                        checked={role === 'organizer'}
                                        onChange={(e) => setRole(e.target.value)}
                                        className="text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4" 
                                    />
                                    <span className="text-sm">Организатор</span>
                                </label>
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full rounded-lg px-4 py-3 text-white font-medium transition-colors focus:outline-none focus:ring-4 focus:ring-indigo-300 ${isLoading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                    >
                        {isLoading ? 'Загрузка...' : isLogin ? 'Войти' : 'Зарегистрироваться'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-600">
                    {isLogin ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
                    <button
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError(null); 
                        }}
                        className="font-semibold text-indigo-600 hover:text-indigo-500 hover:underline"
                    >
                        {isLogin ? 'Создать' : 'Войти'}
                    </button>
                </div>

            </div>
        </div>
    );
};