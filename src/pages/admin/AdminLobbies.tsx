import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { Lobby } from '../../lib/database.types'

const STAKE_PRESETS = [0, 10, 20, 50, 100]

export function AdminLobbies() {
  const { player } = useAuth()
  const [lobbies, setLobbies] = useState<Lobby[]>([])
  const [title, setTitle] = useState('')
  const [stakeAmount, setStakeAmount] = useState(10)
  const [customStake, setCustomStake] = useState('')
  const [useCustomStake, setUseCustomStake] = useState(false)
  const [maxPlayers, setMaxPlayers] = useState(100)

  const finalStake = useCustomStake ? (parseInt(customStake) || 0) : stakeAmount
  const [creating, setCreating] = useState(false)
  const [generatingId, setGeneratingId] = useState<string | null>(null)

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
      .insert({
        title: title.trim(),
        max_players: maxPlayers,
        stake_amount: finalStake,
        status: 'waiting',
        prize_pool: 0,
        countdown_seconds: 60,
      })
      .select('*')
      .single()

    if (error || !data) { setCreating(false); return }

    setLobbies(prev => [data, ...prev])
    setTitle('')
    setCreating(false)

    // Auto-generate 400 cards
    await generateCards(data.id)
  }

  async function generateCards(lobbyId: string) {
    setGeneratingId(lobbyId)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setGeneratingId(null); return }

    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-lobby-cards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ lobby_id: lobbyId }),
    })
    setGeneratingId(null)
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
          onChange={e => setTitle(e.target.value)}
          placeholder="Lobby title (e.g. '10 ETB Game')"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />

        {/* Stake picker */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Stake Amount (ETB)</label>
          <div className="flex gap-2 flex-wrap mb-2">
            {STAKE_PRESETS.map(s => (
              <button
                key={s}
                onClick={() => { setStakeAmount(s); setUseCustomStake(false) }}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                  !useCustomStake && stakeAmount === s
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'border-gray-300 text-gray-600'
                }`}
              >
                {s === 0 ? 'FREE' : `${s} ETB`}
              </button>
            ))}
            <button
              onClick={() => setUseCustomStake(true)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                useCustomStake ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-300 text-gray-600'
              }`}
            >
              Custom
            </button>
          </div>
          {useCustomStake && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={customStake}
                onChange={e => setCustomStake(e.target.value)}
                placeholder="Enter stake amount"
                min="0"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-500">ETB</span>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-1">Final stake: <strong>{finalStake} ETB</strong></p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Max players</label>
          <input
            type="number"
            value={maxPlayers}
            onChange={e => setMaxPlayers(Number(e.target.value))}
            className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm"
          />
        </div>

        <button
          onClick={createLobby}
          disabled={creating || !title.trim()}
          className="w-full py-2 rounded-lg bg-purple-600 text-white font-medium disabled:opacity-40"
        >
          {creating ? 'Creating…' : 'Create Lobby + Generate 400 Cards'}
        </button>
      </div>

      {/* Lobby list */}
      <div className="space-y-2">
        {lobbies.map(l => (
          <div key={l.id} className="flex items-center gap-2 p-4 bg-white rounded-xl border border-gray-200">
            <div className="flex-1 min-w-0">
              <Link to={`/admin/game/${l.id}`} className="font-medium text-gray-800 hover:text-purple-700 block truncate">
                {l.title}
              </Link>
              <div className="text-xs text-gray-400 mt-0.5">
                {l.stake_amount === 0 ? 'FREE' : `${l.stake_amount} ETB`} · {l.status}
              </div>
            </div>
            {generatingId === l.id ? (
              <span className="text-xs text-purple-500 animate-pulse">Generating cards…</span>
            ) : (
              <button
                onClick={() => generateCards(l.id)}
                className="text-xs text-purple-600 border border-purple-300 px-2 py-1 rounded-lg"
              >
                Regen Cards
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
