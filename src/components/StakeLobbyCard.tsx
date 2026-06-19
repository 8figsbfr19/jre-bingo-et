import { useNavigate } from 'react-router-dom'
import type { Lobby } from '../lib/database.types'
import { useCountdown } from '../hooks/useCountdown'

interface Props {
  lobby: Lobby
  playerCount: number
}

const statusColors: Record<string, string> = {
  waiting:   'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  active:    'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  paused:    'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  completed: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
}

const statusLabels: Record<string, string> = {
  waiting: 'Waiting',
  active:  'Active',
  paused:  'Paused',
  completed: 'Done',
}

export function StakeLobbyCard({ lobby, playerCount }: Props) {
  const navigate = useNavigate()
  const { formatted } = useCountdown(lobby.countdown_started_at, lobby.countdown_seconds)
  const prizePool = playerCount * lobby.stake_amount

  const canJoin = lobby.status === 'waiting' && playerCount < lobby.max_players

  function handleJoin() {
    if (canJoin) navigate(`/lobby/${lobby.id}`)
  }

  return (
    <div className="bg-[#1a1035] border border-purple-900/40 rounded-2xl px-4 py-3 flex items-center gap-3">
      {/* Stake */}
      <div className="w-16 shrink-0">
        <div className="text-2xl font-black text-white leading-none">
          {lobby.stake_amount === 0 ? 'FREE' : lobby.stake_amount}
        </div>
        {lobby.stake_amount > 0 && <div className="text-xs text-purple-400 mt-0.5">ETB</div>}
        {lobby.stake_amount === 0 && <div className="text-xs text-purple-400 mt-0.5">DEMO</div>}
      </div>

      {/* Middle info */}
      <div className="flex-1 min-w-0">
        <div className="text-amber-400 font-bold text-sm truncate">{lobby.title}</div>
        <div className="text-purple-300 text-xs mt-0.5">
          {playerCount} players · Win: <span className="text-white font-semibold">{prizePool} ETB</span>
        </div>
        {lobby.countdown_started_at && lobby.status === 'waiting' && (
          <div className="text-purple-400 text-xs mt-0.5">
            Starts in <span className="text-amber-400 font-mono font-semibold">{formatted}</span>
          </div>
        )}
      </div>

      {/* Right: status + join */}
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[lobby.status]}`}>
          {statusLabels[lobby.status]}
        </span>
        {canJoin ? (
          <button
            onClick={handleJoin}
            className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold px-4 py-1.5 rounded-full active:scale-95 transition-transform"
          >
            JOIN
          </button>
        ) : lobby.status === 'active' ? (
          <button
            onClick={() => navigate(`/game/${lobby.id}`)}
            className="bg-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded-full"
          >
            Watch
          </button>
        ) : (
          <div className="text-purple-500 text-xs font-medium px-3 py-1.5">
            {lobby.status === 'completed' ? 'Ended' : 'Full'}
          </div>
        )}
      </div>
    </div>
  )
}
