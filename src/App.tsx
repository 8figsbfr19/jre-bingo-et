import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { StakeLobby } from './pages/StakeLobby'
import { CardSelection } from './pages/CardSelection'
import { WaitingRoom } from './pages/WaitingRoom'
import { GameRoom } from './pages/GameRoom'
import { Result } from './pages/Result'
import { Profile } from './pages/Profile'
import { History } from './pages/History'
import { Leaderboard } from './pages/Leaderboard'
import { Wallet } from './pages/Wallet'
import { AdminHome } from './pages/admin/AdminHome'
import { AdminLobbies } from './pages/admin/AdminLobbies'
import { AdminGame } from './pages/admin/AdminGame'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Player routes */}
        <Route path="/" element={<StakeLobby />} />
        <Route path="/lobby/:id" element={<CardSelection />} />
        <Route path="/lobby/:id/waiting" element={<WaitingRoom />} />
        <Route path="/game/:id" element={<GameRoom />} />
        <Route path="/result/:id" element={<Result />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/history" element={<History />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/wallet" element={<Wallet />} />

        {/* Admin routes */}
        <Route path="/admin" element={<AdminHome />} />
        <Route path="/admin/lobbies" element={<AdminLobbies />} />
        <Route path="/admin/game/:id" element={<AdminGame />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
