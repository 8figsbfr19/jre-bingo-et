import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export function AdminHome() {
  const { player } = useAuth()

  if (!player?.is_admin) {
    return <div className="flex h-screen items-center justify-center text-gray-400">Access denied.</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 pt-8 pb-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Panel</h1>
      <div className="space-y-3">
        <Link
          to="/admin/lobbies"
          className="block w-full py-4 px-5 rounded-xl bg-white border border-gray-200 shadow-sm font-semibold text-gray-800"
        >
          Manage Lobbies →
        </Link>
      </div>
    </div>
  )
}
