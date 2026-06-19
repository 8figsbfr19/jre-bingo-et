import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { BottomNav } from '../components/BottomNav'
import type { GameHistory } from '../lib/database.types'

interface HistoryWithLobby extends GameHistory { lobby_title?: string }

export function History() {
  const { player } = useAuth()
  const [tab, setTab] = useState<'recent' | 'mine'>('recent')
  const [filter, setFilter] = useState<'all' | 'wins' | 'losses'>('all')
  const [games, setGames] = useState<HistoryWithLobby[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      let query = supabase
        .from('game_history')
        .select('*')
        .order('ended_at', { ascending: false })
        .limit(30)

      if (tab === 'mine' && player) {
        query = supabase
          .from('game_history')
          .select('*')
          .or(`winner_id.eq.${player.id}`)
          .order('ended_at', { ascending: false })
          .limit(30)
      }

      const { data } = await query

      if (!data) { setLoading(false); return }

      // Fetch lobby titles
      const lobbyIds = [...new Set(data.map(g => g.lobby_id))]
      const { data: lobbies } = await supabase
        .from('lobbies')
        .select('id, title')
        .in('id', lobbyIds)

      const lobbyMap = Object.fromEntries((lobbies ?? []).map(l => [l.id, l.title]))
      setGames(data.map(g => ({ ...g, lobby_title: lobbyMap[g.lobby_id] })))
      setLoading(false)
    }
    load()
  }, [tab, player])

  const filtered = games.filter(g => {
    if (!player) return true
    if (filter === 'wins') return g.winner_id === player.id
    if (filter === 'losses') return g.winner_id !== player.id
    return true
  })

  return (
    <div className="min-h-screen bg-[#0d0923] pb-24">
      <div className="bg-[#1a1035] border-b border-purple-900/40 px-4 py-4 flex items-center justify-between">
        <h1 className="text-white font-black text-xl">Bingo History</h1>
      </div>

      {/* Tabs */}
      <div className="flex mx-4 mt-4 gap-2 bg-[#1a1035] rounded-xl p-1">
        {(['recent', 'mine'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t ? 'bg-purple-600 text-white' : 'text-purple-400'
            }`}
          >
            {t === 'recent' ? 'Recent Games' : 'My Games'}
          </button>
        ))}
      </div>

      {/* Filter pills */}
      {tab === 'mine' && (
        <div className="flex gap-2 px-4 mt-3">
          {(['all', 'wins', 'losses'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                filter === f
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'border-purple-800 text-purple-400'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)} Games
            </button>
          ))}
        </div>
      )}

      <div className="px-4 mt-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-purple-600 text-sm">No games found.</div>
        ) : (
          filtered.map(g => {
            const isWin = g.winner_id === player?.id
            return (
              <div key={g.id} className="bg-[#1a1035] rounded-xl border border-purple-900/40 px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-white font-semibold text-sm">{g.lobby_title ?? 'Game'}</div>
                  <div className="text-purple-500 text-xs mt-0.5">
                    {new Date(g.ended_at).toLocaleDateString()} · {g.balls_called} balls · {g.total_players} players
                  </div>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  isWin ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {isWin ? 'Won' : g.winner_id ? 'Lost' : 'Played'}
                </span>
              </div>
            )
          })
        )}
      </div>

      <BottomNav />
    </div>
  )
}
