import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { Lobby } from '../../lib/database.types'

export function AdminLobbies() {
  const { player } = useAuth()
  const [lobbies, setLobbies] = useState<Lobby[]>([])
  const [title, setTitle] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(100)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    supabase
      .from('lobbies')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setLobbies(data ?? []))
  }, [])

  if (!player?.is_admin) {
    return <div className="flex h-screen items-center justify-center text-gray-400">Access denied.</div>
  }

  async function createLobby() {
    if (!title.trim() || creating) return
    setCreating(true)
    const { data, error } = await supabase
      .from('lobbies')
      .insert({ title: title.trim(), max_players: maxPlayers, status: 'waiting' })
      .select('*')
      .single()
    setCreating(false)
    if (!error && data) {
      setLobbies((prev) => [data, ...prev])
      setTitle('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 pt-6 pb-10">
      <Link to="/admin" className="text-sm text-gray-400 mb-4 block">← Admin</Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Lobbies</h1>

      {/* Create form */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-3">
        <h2 className="font-semibold text-gray-700">New Lobby</h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Lobby title"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Max players</label>
          <input
            type="number"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
            className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm"
          />
        </div>
        <button
          onClick={createLobby}
          disabled={creating || !title.trim()}
          className="w-full py-2 rounded-lg bg-brand text-white font-medium disabled:opacity-40"
        >
          {creating ? 'Creating…' : 'Create Lobby'}
        </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {lobbies.map((l) => (
          <Link
            key={l.id}
            to={`/admin/game/${l.id}`}
            className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200"
          >
            <span className="font-medium text-gray-800">{l.title}</span>
            <span className="text-sm text-gray-500 capitalize">{l.status}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
