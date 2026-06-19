import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function Home() {
  const { player, loading, error, inTelegram, retry } = useAuth()

  if (loading) {
    return (
      <div className="flex flex-col h-screen items-center justify-center gap-3 text-gray-400">
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Connecting…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 bg-gray-50">
      <div className="text-6xl mb-4">🎱</div>
      <h1 className="text-3xl font-bold text-gray-900 mb-1">JRE Bingo ET</h1>
      <p className="text-gray-500 mb-8 text-center">The ultimate bingo experience</p>

      {player ? (
        <div className="w-full max-w-sm space-y-3">
          <p className="text-center text-sm text-gray-500">
            Welcome, <span className="font-medium text-gray-800">{player.first_name ?? 'Player'}</span>!
          </p>
          <Link
            to="/lobbies"
            className="block w-full py-3 text-center rounded-xl bg-brand text-white font-semibold text-lg shadow"
          >
            Browse Lobbies
          </Link>
          {player.is_admin && (
            <Link
              to="/admin"
              className="block w-full py-3 text-center rounded-xl border border-brand text-brand font-semibold"
            >
              Admin Panel
            </Link>
          )}
        </div>
      ) : error ? (
        <div className="w-full max-w-sm space-y-3">
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 break-words">
            {error}
          </div>
          <button
            onClick={retry}
            className="w-full py-3 rounded-xl bg-brand text-white font-semibold"
          >
            Try again
          </button>
        </div>
      ) : inTelegram ? (
        <div className="w-full max-w-sm space-y-3">
          <p className="text-center text-sm text-gray-500">Almost there…</p>
          <button
            onClick={retry}
            className="w-full py-3 rounded-xl bg-brand text-white font-semibold"
          >
            Tap to continue
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-400">Open this app inside Telegram to play.</p>
      )}
    </div>
  )
}
