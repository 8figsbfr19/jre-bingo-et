import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { StakeLobbyCard } from '../components/StakeLobbyCard'
import { BottomNav } from '../components/BottomNav'
import type { Lobby } from '../lib/database.types'

interface LobbyWithCount extends Lobby { playerCount: number }

export function StakeLobby() {
  const { player, loading: authLoading } = useAuth()
  const [lobbies, setLobbies] = useState<LobbyWithCount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('lobbies')
        .select('*')
        .neq('status', 'completed')
        .order('stake_amount', { ascending: true })

      if (!data) { setLoading(false); return }

      const withCounts = await Promise.all(
        data.map(async (lobby) => {
          const { count } = await supabase
            .from('lobby_cards')
            .select('*', { count: 'exact', head: true })
            .eq('lobby_id', lobby.id)
            .not('player_id', 'is', null)
          return { ...lobby, playerCount: count ?? 0 }
        }),
      )
      setLobbies(withCounts)
      setLoading(false)
    }
    load()

    // Realtime: update player counts
    const ch = supabase
      .channel('lobbies_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobbies' }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobby_cards' }, () => load())
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0d0923]">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!player) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0d0923] px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">🎱</div>
          <h1 className="text-2xl font-black text-white mb-2">JRE Bingo ET</h1>
          <p className="text-purple-400 text-sm">Open this app inside Telegram to play.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0d0923] pb-20">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-[#0d0923]/95 backdrop-blur border-b border-purple-900/40 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-xs font-semibold">LIVE</span>
        </div>
        <h1 className="text-white font-black text-lg tracking-wide">🎱 JRE BINGO ET</h1>
        <div className="text-right">
          <div className="text-xs text-purple-400">Balance</div>
          <div className="text-amber-400 font-bold text-sm">0.00</div>
        </div>
      </div>

      <div className="px-4 pt-4">
        <h2 className="text-purple-300 text-xs font-bold uppercase tracking-widest mb-3">BINGO GAMES</h2>

        {lobbies.length === 0 ? (
          <div className="text-center py-20 text-purple-500 text-sm">
            No active lobbies right now.<br />Check back soon!
          </div>
        ) : (
          <div className="space-y-3">
            {lobbies.map(l => (
              <StakeLobbyCard key={l.id} lobby={l} playerCount={l.playerCount} />
            ))}
          </div>
        )}

        {player.is_admin && (
          <div className="mt-6 pt-4 border-t border-purple-900/40">
            <a href="/admin" className="block w-full py-3 text-center rounded-xl bg-purple-800/40 border border-purple-700/40 text-purple-300 text-sm font-semibold">
              Admin Panel →
            </a>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
