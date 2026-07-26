import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Lobby } from './pages/Lobby';
import { Quiz } from './pages/Quiz';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* По умолчанию перенаправляем на авторизацию */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/lobby/:roomCode" element={<Lobby />} />
        <Route path="/quiz/:roomCode" element={<Quiz />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;