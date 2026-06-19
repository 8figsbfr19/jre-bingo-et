import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { LobbyCard } from '../components/LobbyCard'
import type { Lobby } from '../lib/database.types'

interface LobbyWithCount extends Lobby {
  playerCount: number
}

export function Lobbies() {
  const [lobbies, setLobbies] = useState<LobbyWithCount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('lobbies')
        .select('*')
        .neq('status', 'completed')
        .order('created_at', { ascending: false })

      if (!data) { setLoading(false); return }

      const withCounts = await Promise.all(
        data.map(async (lobby) => {
          const { count } = await supabase
            .from('lobby_players')
            .select('*', { count: 'exact', head: true })
            .eq('lobby_id', lobby.id)
          return { ...lobby, playerCount: count ?? 0 }
        }),
      )

      setLobbies(withCounts)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400">Loading…</div>

  return (
    <div className="min-h-screen bg-gray-50 px-4 pt-6 pb-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Lobbies</h1>
      {lobbies.length === 0 ? (
        <p className="text-gray-400 text-center mt-20">No active lobbies right now.</p>
      ) : (
        <div className="space-y-3">
          {lobbies.map((l) => (
            <LobbyCard key={l.id} lobby={l} playerCount={l.playerCount} />
          ))}
        </div>
      )}
    </div>
  )
}
