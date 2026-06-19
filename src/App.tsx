import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Home } from './pages/Home'
import { Lobbies } from './pages/Lobbies'
import { LobbyDetail } from './pages/LobbyDetail'
import { Game } from './pages/Game'
import { AdminHome } from './pages/admin/AdminHome'
import { AdminLobbies } from './pages/admin/AdminLobbies'
import { AdminGame } from './pages/admin/AdminGame'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lobbies" element={<Lobbies />} />
        <Route path="/lobby/:id" element={<LobbyDetail />} />
        <Route path="/game/:id" element={<Game />} />
        <Route path="/admin" element={<AdminHome />} />
        <Route path="/admin/lobbies" element={<AdminLobbies />} />
        <Route path="/admin/game/:id" element={<AdminGame />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
