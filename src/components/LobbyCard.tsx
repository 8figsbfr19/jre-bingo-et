import { Link } from 'react-router-dom'
import type { Lobby } from '../lib/database.types'

const statusColor: Record<string, string> = {
  waiting: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-blue-100 text-blue-800',
  completed: 'bg-gray-100 text-gray-500',
}

interface Props {
  lobby: Lobby
  playerCount: number
}

export function LobbyCard({ lobby, playerCount }: Props) {
  return (
    <Link
      to={`/lobby/${lobby.id}`}
      className="block p-4 rounded-xl border border-gray-200 bg-white shadow-sm active:scale-95 transition-transform"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-900">{lobby.title}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[lobby.status]}`}>
          {lobby.status.charAt(0).toUpperCase() + lobby.status.slice(1)}
        </span>
      </div>
      <div className="mt-1 text-sm text-gray-500">
        {playerCount} / {lobby.max_players} players
      </div>
    </Link>
  )
}
