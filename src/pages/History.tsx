import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { BottomNav } from '../components/BottomNav'
import { BingoCardDisplay } from '../components/BingoCardDisplay'
import { formatDate, displayName } from '../lib/utils'

interface EnrichedHistory {
  id: string
  lobby_id: string
  ended_at: string
  prize_pool: number
  total_players: number
  balls_called: number
  winner_id: string | null
  winner_card_id: string | null
  lobby_title?: string
  lobby_stake?: number
  winner_name?: string
  winner_card_number?: number
  winner_card_data?: (number | null)[][]
  my_card_number?: number
  my_card_data?: (number | null)[][]
  called_numbers?: number[]
}

interface CardModalData {
  title: string
  card: (number | null)[][]
  cardNumber: number
  calledNumbers: number[]
  won: boolean
  prizePool: number
}

export function History() {
  const { player } = useAuth()
  const [tab, setTab] = useState<'recent' | 'mine'>('recent')
  const [filter, setFilter] = useState<'all' | 'wins' | 'losses'>('all')
  const [rows, setRows] = useState<EnrichedHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<CardModalData | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)

      const { data: games } = await supabase
        .from('game_history')
        .select('*')
        .order('ended_at', { ascending: false })
        .limit(30)

      if (!games) { setLoading(false); return }

      const lobbyIds = [...new Set(games.map(g => g.lobby_id))]

      const [{ data: lobbies }, { data: winnerCards }, { data: myCards }, { data: allCalled }] =
        await Promise.all([
          supabase.from('lobbies').select('id, title, stake_amount').in('id', lobbyIds),
          supabase.from('lobby_cards').select('id, card_number, card_data').in('id', games.map(g => g.winner_card_id).filter(Boolean)),
          player
            ? supabase.from('lobby_cards').select('lobby_id, card_number, card_data').in('lobby_id', lobbyIds).eq('player_id', player.id)
            : { data: [] },
          supabase.from('called_numbers').select('lobby_id, number').in('lobby_id', lobbyIds),
        ])

      const winnerPlayerIds = [...new Set(games.map(g => g.winner_id).filter(Boolean))]
      const { data: winnerPlayers } = winnerPlayerIds.length > 0
        ? await supabase.from('players').select('id, first_name, telegram_username').in('id', winnerPlayerIds)
        : { data: [] }

      const lobbyMap = Object.fromEntries((lobbies ?? []).map(l => [l.id, l]))
      const winnerCardMap = Object.fromEntries((winnerCards ?? []).map(c => [c.id, c]))
      const myCardMap = Object.fromEntries((myCards ?? []).map(c => [c.lobby_id, c]))
      const winnerPlayerMap = Object.fromEntries((winnerPlayers ?? []).map(p => [p.id, p]))

      // Group called numbers by lobby
      const calledByLobby: Record<string, number[]> = {}
      ;(allCalled ?? []).forEach(r => {
        calledByLobby[r.lobby_id] = [...(calledByLobby[r.lobby_id] ?? []), r.number]
      })

      const enriched: EnrichedHistory[] = games.map((g, idx) => {
        const lobby = lobbyMap[g.lobby_id]
        const wc = g.winner_card_id ? winnerCardMap[g.winner_card_id] : null
        const mc = myCardMap[g.lobby_id]
        const wp = g.winner_id ? winnerPlayerMap[g.winner_id] : null
        return {
          ...g,
          lobby_title: lobby?.title,
          lobby_stake: lobby?.stake_amount,
          winner_name: wp ? displayName(wp) : undefined,
          winner_card_number: wc?.card_number,
          winner_card_data: wc?.card_data,
          my_card_number: mc?.card_number,
          my_card_data: mc?.card_data,
          called_numbers: calledByLobby[g.lobby_id] ?? [],
          _idx: idx,
        } as EnrichedHistory & { _idx: number }
      })

      setRows(enriched)
      setLoading(false)
    }
    load()
  }, [tab, player])

  const filtered = rows.filter(g => {
    if (tab === 'mine' && player && g.winner_id !== player.id && !g.my_card_number) return false
    if (filter === 'wins' && player) return g.winner_id === player.id
    if (filter === 'losses' && player) return g.winner_id !== player.id
    return true
  })

  function openWinnerCard(g: EnrichedHistory) {
    if (!g.winner_card_data || !g.winner_card_number) return
    setModal({
      title: 'Winning Card',
      card: g.winner_card_data,
      cardNumber: g.winner_card_number,
      calledNumbers: g.called_numbers ?? [],
      won: true,
      prizePool: g.prize_pool,
    })
  }

  function openMyCard(g: EnrichedHistory) {
    if (!g.my_card_data || !g.my_card_number) return
    const isWin = player && g.winner_id === player.id
    setModal({
      title: isWin ? 'Your Winning Card' : 'Your Card',
      card: g.my_card_data,
      cardNumber: g.my_card_number,
      calledNumbers: g.called_numbers ?? [],
      won: !!isWin,
      prizePool: g.prize_pool,
    })
  }

  return (
    <div className="min-h-screen bg-[#0d0923] pb-24">
      <div className="bg-[#1a1035] border-b border-purple-900/40 px-4 py-4">
        <h1 className="text-white font-black text-xl">Bingo History</h1>
      </div>

      {/* Tabs */}
      <div className="flex mx-4 mt-4 gap-2 bg-[#1a1035] rounded-xl p-1">
        {(['recent', 'mine'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold ${tab === t ? 'bg-purple-600 text-white' : 'text-purple-400'}`}>
            {t === 'recent' ? 'Recent Games' : 'My Games'}
          </button>
        ))}
      </div>

      {tab === 'mine' && (
        <div className="flex gap-2 px-4 mt-3">
          {(['all', 'wins', 'losses'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${filter === f ? 'bg-purple-600 text-white border-purple-600' : 'border-purple-800 text-purple-400'}`}>
              {f === 'all' ? 'All' : f === 'wins' ? 'Wins' : 'Losses'}
            </button>
          ))}
        </div>
      )}

      <div className="px-4 mt-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-purple-600 text-sm">No games found.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((g, idx) => {
              const isWin = player && g.winner_id === player.id
              return (
                <div key={g.id} className="bg-[#1a1035] rounded-xl border border-purple-900/40 p-3">
                  {/* Row header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-purple-600 text-xs font-mono">#{idx + 1}</span>
                      <span className="text-white font-semibold text-sm">{g.lobby_title ?? 'Game'}</span>
                      {g.lobby_stake !== undefined && (
                        <span className="text-amber-400 text-xs font-semibold">{g.lobby_stake === 0 ? 'FREE' : `${g.lobby_stake} ETB`}</span>
                      )}
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isWin ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                      {isWin ? 'Won' : 'Lost'}
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="flex gap-3 text-xs text-purple-500 mb-2">
                    <span>Pool: <span className="text-amber-400 font-semibold">{g.prize_pool} ETB</span></span>
                    <span>{g.balls_called} balls</span>
                    <span>{g.total_players} players</span>
                  </div>

                  {/* Cards row */}
                  <div className="flex gap-2 mb-2">
                    {g.winner_card_number && (
                      <button onClick={() => openWinnerCard(g)}
                        className="flex-1 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
                        Winner Card #{g.winner_card_number}
                      </button>
                    )}
                    {g.my_card_number && (
                      <button onClick={() => openMyCard(g)}
                        className="flex-1 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold">
                        Your Card #{g.my_card_number}
                      </button>
                    )}
                  </div>

                  {/* Date */}
                  <div className="text-purple-600 text-[10px]">{formatDate(g.ended_at)}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Card modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80" onClick={() => setModal(null)}>
          <div className="bg-[#1a1035] rounded-t-3xl w-full max-w-sm p-6 pb-10" onClick={e => e.stopPropagation()}>
            <div className={`text-sm font-bold mb-1 ${modal.won ? 'text-amber-400' : 'text-purple-300'}`}>
              {modal.title}
            </div>
            <div className="text-purple-500 text-xs mb-4">
              Prize Pool: <span className="text-amber-400 font-semibold">{modal.prizePool} ETB</span>
            </div>
            <BingoCardDisplay card={modal.card} calledNumbers={modal.calledNumbers} cardNumber={modal.cardNumber} />
            <button onClick={() => setModal(null)} className="mt-5 w-full py-3 rounded-xl border border-purple-700 text-purple-300 font-semibold">
              Close
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
