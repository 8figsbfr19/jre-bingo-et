import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BottomNav } from '../components/BottomNav'
import type { Player } from '../lib/database.types'

interface LeaderEntry { player: Player; wins: number }

export function Leaderboard() {
  const [tab, setTab] = useState<'scores' | 'recent'>('scores')
  const [entries, setEntries] = useState<LeaderEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('game_history')
        .select('winner_id')
        .not('winner_id', 'is', null)

      if (!data) { setLoading(false); return }

      // Count wins per player
      const counts: Record<string, number> = {}
      data.forEach(g => { if (g.winner_id) counts[g.winner_id] = (counts[g.winner_id] ?? 0) + 1 })

      const playerIds = Object.keys(counts)
      if (playerIds.length === 0) { setLoading(false); return }

      const { data: players } = await supabase.from('players').select('*').in('id', playerIds)
      const list: LeaderEntry[] = (players ?? [])
        .map(p => ({ player: p, wins: counts[p.id] ?? 0 }))
        .sort((a, b) => b.wins - a.wins)
        .slice(0, 20)

      setEntries(list)
      setLoading(false)
    }
    load()
  }, [])

  const rankColors = ['text-amber-400', 'text-gray-300', 'text-amber-700']
  const rankBg = ['bg-amber-500/20', 'bg-gray-500/20', 'bg-amber-800/20']

  return (
    <div className="min-h-screen bg-[#0d0923] pb-24">
      <div className="bg-[#1a1035] border-b border-purple-900/40 px-4 py-4">
        <h1 className="text-white font-black text-xl">Leaderboard</h1>
      </div>

      {/* Tabs */}
      <div className="flex mx-4 mt-4 gap-2 bg-[#1a1035] rounded-xl p-1">
        {([['scores', 'Score Board'], ['recent', 'Recent Winners']] as const).map(([t, l]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold ${tab === t ? 'bg-purple-600 text-white' : 'text-purple-400'}`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="px-4 mt-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-purple-600 text-sm">No winners yet. Be the first!</div>
        ) : (
          entries.map((e, idx) => {
            const initials = (e.player.first_name?.[0] ?? e.player.telegram_username?.[0] ?? 'P').toUpperCase()
            const name = e.player.first_name ?? e.player.telegram_username ?? 'Player'
            return (
              <div key={e.player.id} className="bg-[#1a1035] rounded-xl border border-purple-900/40 px-4 py-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${rankBg[idx] ?? 'bg-purple-900/40'}`}>
                  <span className={rankColors[idx] ?? 'text-purple-400'}>#{idx + 1}</span>
                </div>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm ${
                  idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-gray-500' : idx === 2 ? 'bg-amber-700' : 'bg-purple-700'
                }`}>
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold text-sm truncate">{name}</div>
                  {e.player.telegram_username && (
                    <div className="text-purple-500 text-xs truncate">@{e.player.telegram_username}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-amber-400 font-black">{e.wins}</div>
                  <div className="text-purple-600 text-xs">wins</div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <BottomNav />
    </div>
  )
}
