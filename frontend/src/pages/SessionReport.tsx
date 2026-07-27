import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface PlayerReport {
    username: string;
    score: number;
    place: number;
}

interface SessionReport {
    quiz_title: string;
    played_at: string;
    players: PlayerReport[];
}

export const SessionReport = () => {
    const { roomCode } = useParams<{ roomCode: string }>();
    const navigate = useNavigate();
    
    const [report, setReport] = useState<SessionReport | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchReport = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`http://localhost:8080/api/v1/quizzes/sessions/${roomCode}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Не удалось загрузить отчет или у вас нет прав');
                
                const data = await res.json();
                setReport(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchReport();
    }, [roomCode]);

    if (isLoading) {
        return <div className="flex min-h-screen items-center justify-center bg-gray-100 text-xl font-bold text-gray-400">Загрузка отчета...</div>;
    }

    if (error) {
        return <div className="flex min-h-screen items-center justify-center bg-gray-100 p-8 text-center text-red-500">{error}</div>;
    }

    if (!report) return null;

    return (
        <div className="min-h-screen bg-gray-100 p-8 font-sans">
            <div className="mx-auto max-w-4xl">
                {/* Кнопка назад */}
                <button 
                    onClick={() => navigate('/dashboard')} 
                    className="mb-6 flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 transition-colors"
                >
                    ← Вернуться в кабинет
                </button>
                
                {/* Отчет */}
                <div className="rounded-2xl bg-white p-8 shadow-sm">
                    
                    <div className="mb-10 border-b border-gray-100 pb-8 text-center">
                        <span className="mb-2 inline-block rounded-full bg-indigo-100 px-4 py-1 text-xs font-bold uppercase tracking-widest text-indigo-700">
                            Аналитика игры
                        </span>
                        <h1 className="mt-4 text-4xl font-extrabold text-gray-900">{report.quiz_title}</h1>
                        <p className="mt-4 text-lg text-gray-500">
                            Код комнаты: <span className="font-mono font-bold text-indigo-600">{roomCode}</span> • Завершен: {report.played_at}
                        </p>
                    </div>

                    <h2 className="mb-6 text-xl font-semibold text-gray-800">Итоговый рейтинг участников</h2>
                    
                    <div className="flex flex-col gap-4">
                        {report.players.map((player, idx) => (
                            <div key={idx} className={`flex items-center justify-between rounded-xl border-2 p-5 shadow-sm transition-transform hover:scale-[1.01] ${
                                player.place === 1 ? 'bg-yellow-50 border-yellow-200' : 
                                player.place === 2 ? 'bg-gray-50 border-gray-200' : 
                                player.place === 3 ? 'bg-orange-50 border-orange-200' : 
                                'bg-white border-gray-100'
                            }`}>
                                <div className="flex items-center gap-4">
                                    <div className={`flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold text-white shadow-md ${
                                        player.place === 1 ? 'bg-yellow-400' : 
                                        player.place === 2 ? 'bg-gray-400' : 
                                        player.place === 3 ? 'bg-orange-500' : 
                                        'bg-indigo-100 text-indigo-700'
                                    }`}>
                                        {player.place}
                                    </div>
                                    <span className="text-xl font-bold text-gray-800">{player.username}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-3xl font-black text-indigo-600">{player.score}</span>
                                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400 mt-1">баллов</span>
                                </div>
                            </div>
                        ))}

                        {report.players.length === 0 && (
                            <div className="rounded-xl border-2 border-dashed border-gray-200 p-10 text-center text-gray-500">
                                В этой игре не было активных участников.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};