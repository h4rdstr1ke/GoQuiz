import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Lobby } from './pages/Lobby';
import { Quiz } from './pages/Quiz';
import { CreateQuiz } from './pages/CreateQuiz';
import { SessionReport } from './pages/SessionReport';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* По умолчанию перенаправляем на авторизацию */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/create-quiz" element={<CreateQuiz />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/lobby/:roomCode" element={<Lobby />} />
        <Route path="/quiz/:roomCode" element={<Quiz />} />
        <Route path="/report/:roomCode" element={<SessionReport/>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;