import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLobby } from '../hooks/useLobby'
import { useAuth } from '../hooks/useAuth'

export function LobbyDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { lobby, loading } = useLobby(id)
  const { player } = useAuth()
  const [joined, setJoined] = useState(false)
  const [playerCount, setPlayerCount] = useState(0)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (!id || !player) return
    supabase
      .from('lobby_players')
      .select('id', { count: 'exact' })
      .eq('lobby_id', id)
      .then(({ data, count }) => {
        setPlayerCount(count ?? 0)
        const mine = data?.find((r) => r.id)
        void mine
      })
    supabase
      .from('lobby_players')
      .select('id')
      .eq('lobby_id', id)
      .eq('player_id', player.id)
      .single()
      .then(({ data }) => setJoined(!!data))
  }, [id, player])

  // Redirect when game starts
  useEffect(() => {
    if (lobby?.status === 'active') navigate(`/game/${id}`)
  }, [lobby?.status, id, navigate])

  async function handleJoin() {
    if (!player || !id || joining) return
    setJoining(true)
    await supabase.from('lobby_players').insert({ lobby_id: id, player_id: player.id })
    setJoined(true)
    setPlayerCount((c) => c + 1)
    setJoining(false)
  }

  async function handleLeave() {
    if (!player || !id) return
    await supabase.from('lobby_players').delete().eq('lobby_id', id).eq('player_id', player.id)
    setJoined(false)
    setPlayerCount((c) => Math.max(0, c - 1))
  }

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400">Loading…</div>
  if (!lobby) return <div className="flex h-screen items-center justify-center text-gray-400">Lobby not found.</div>

  const isFull = playerCount >= lobby.max_players && !joined

  return (
    <div className="min-h-screen bg-gray-50 px-4 pt-8 pb-10">
      <button onClick={() => navigate('/lobbies')} className="text-sm text-gray-400 mb-4">← Back</button>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">{lobby.title}</h1>
      <p className="text-gray-500 text-sm mb-6">
        {playerCount} / {lobby.max_players} players · {lobby.status}
      </p>

      {lobby.status === 'waiting' && player && (
        joined ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center text-green-700 font-medium">
              You're in! Waiting for the game to start…
            </div>
            <button
              onClick={handleLeave}
              className="w-full py-3 rounded-xl border border-gray-300 text-gray-600 font-medium"
            >
              Leave lobby
            </button>
          </div>
        ) : (
          <button
            onClick={handleJoin}
            disabled={isFull || joining}
            className={[
              'w-full py-3 rounded-xl font-semibold text-lg',
              isFull ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-brand text-white shadow',
            ].join(' ')}
          >
            {isFull ? 'Lobby full' : joining ? 'Joining…' : 'Join Lobby'}
          </button>
        )
      )}

      {lobby.status === 'completed' && (
        <p className="text-gray-400 text-center mt-10">This game has ended.</p>
      )}
    </div>
  )
}
