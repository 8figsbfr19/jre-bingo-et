import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { BottomNav } from '../components/BottomNav'

export function Profile() {
  const { player } = useAuth()
  const [gamesWon, setGamesWon] = useState(0)
  const [totalGames, setTotalGames] = useState(0)

  useEffect(() => {
    if (!player) return
    supabase.from('game_history').select('*', { count: 'exact', head: true }).eq('winner_id', player.id)
      .then(({ count }) => setGamesWon(count ?? 0))
    supabase.from('lobby_cards').select('*', { count: 'exact', head: true }).eq('player_id', player.id)
      .then(({ count }) => setTotalGames(count ?? 0))
  }, [player])

  const initials = (player?.first_name?.[0] ?? player?.telegram_username?.[0] ?? 'P').toUpperCase()
  const displayName = player?.first_name ?? player?.telegram_username ?? 'Player'

  return (
    <div className="min-h-screen bg-[#0d0923] pb-24">
      {/* Header */}
      <div className="bg-[#1a1035] border-b border-purple-900/40 px-4 pt-8 pb-6 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center mx-auto mb-3 border-2 border-purple-500">
          <span className="text-3xl font-black text-white">{initials}</span>
        </div>
        <h1 className="text-white text-xl font-black">{displayName}</h1>
        {player?.telegram_username && (
          <p className="text-purple-400 text-sm mt-0.5">@{player.telegram_username}</p>
        )}
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Balance', value: '0 ETB', sub: 'Placeholder' },
            { label: 'Bonus', value: '0', sub: 'Placeholder' },
            { label: 'Games Played', value: totalGames.toString(), sub: 'All time' },
            { label: 'Games Won', value: gamesWon.toString(), sub: 'All time' },
          ].map(stat => (
            <div key={stat.label} className="bg-[#1a1035] rounded-2xl p-4 border border-purple-900/40">
              <div className="text-purple-400 text-xs mb-1">{stat.label}</div>
              <div className="text-white font-black text-xl">{stat.value}</div>
              <div className="text-purple-600 text-xs">{stat.sub}</div>
            </div>
          ))}
        </div>

        {/* Settings */}
        <div className="bg-[#1a1035] rounded-2xl border border-purple-900/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-purple-900/40">
            <span className="text-white font-semibold text-sm">Settings</span>
          </div>
          {[
            { label: 'Sound', value: 'On' },
            { label: 'Notifications', value: 'On' },
            { label: 'Language', value: 'English' },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between px-4 py-3 border-b border-purple-900/20 last:border-0">
              <span className="text-purple-200 text-sm">{s.label}</span>
              <span className="text-purple-400 text-sm">{s.value}</span>
            </div>
          ))}
        </div>

        <div className="text-center text-purple-700 text-xs">© JRE Bingo ET · V1</div>
      </div>

      <BottomNav />
    </div>
  )
}
