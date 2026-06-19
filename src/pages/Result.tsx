import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLobbyCards } from '../hooks/useLobbyCards'
import { useCalledNumbers } from '../hooks/useCalledNumbers'
import { useAuth } from '../hooks/useAuth'
import { BingoCardDisplay } from '../components/BingoCardDisplay'
import { formatDate, displayName } from '../lib/utils'
import type { GameHistory, Player, LobbyCard } from '../lib/database.types'
import { BottomNav } from '../components/BottomNav'

export function Result() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { player } = useAuth()
  const { cards } = useLobbyCards(id)
  const calledNumbers = useCalledNumbers(id)

  const [history, setHistory] = useState<GameHistory | null>(null)
  const [winner, setWinner] = useState<Player | null>(null)
  const [winnerCard, setWinnerCard] = useState<LobbyCard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    // Poll a few times since game_history may be written slightly after lobby completes
    let tries = 0
    const attempt = async () => {
      const { data } = await supabase.from('game_history').select('*').eq('lobby_id', id).single()
      if (data) {
        setHistory(data)
        setLoading(false)
        if (data.winner_id) {
          supabase.from('players').select('*').eq('id', data.winner_id).single()
            .then(({ data: p }) => setWinner(p ?? null))
        }
        if (data.winner_card_id) {
          supabase.from('lobby_cards').select('*').eq('id', data.winner_card_id).single()
            .then(({ data: c }) => setWinnerCard(c ?? null))
        }
      } else if (tries < 5) {
        tries++
        setTimeout(attempt, 1500)
      } else {
        setLoading(false)
      }
    }
    attempt()
  }, [id])

  const myCard = cards.find(c => c.player_id === player?.id)
  const numbers = calledNumbers.map(c => c.number)
  const isWinner = history?.winner_id === player?.id

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#0d0923] gap-3">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-purple-400 text-sm">Loading results…</p>
      </div>
    )
  }

  return (
    <div className={`min-h-screen pb-24 ${isWinner ? 'bg-gradient-to-b from-amber-900/40 to-[#0d0923]' : 'bg-gradient-to-b from-red-950/60 to-[#0d0923]'}`}>
      {/* Header */}
      <div className="text-center pt-10 pb-5 px-4">
        <div className="text-6xl mb-3">{isWinner ? '🏆' : '😔'}</div>
        <h1 className={`text-4xl font-black mb-2 ${isWinner ? 'text-amber-400' : 'text-red-400'}`}>
          {isWinner ? 'You Won!' : 'You Lost'}
        </h1>
        {history && (
          <>
            <div className="text-white font-bold text-xl">
              Total Pool: <span className="text-amber-400">{history.prize_pool} ETB</span>
            </div>
            <div className="text-purple-400 text-xs mt-1">
              {history.balls_called} balls · {history.total_players} players · {formatDate(history.ended_at)}
            </div>
          </>
        )}
      </div>

      <div className="px-4 space-y-4">
        {/* Winner info row */}
        {!isWinner && winner && (
          <div className="bg-[#1a1035] rounded-2xl p-4 border border-red-900/30">
            <div className="text-purple-400 text-xs font-semibold uppercase tracking-widest mb-2">Winner</div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center font-black text-white">
                {(winner.first_name?.[0] ?? winner.telegram_username?.[0] ?? 'W').toUpperCase()}
              </div>
              <div>
                <div className="text-white font-bold">{displayName(winner)}</div>
                {winner.telegram_username && (
                  <div className="text-purple-500 text-xs">@{winner.telegram_username}</div>
                )}
              </div>
              {winnerCard && (
                <div className="ml-auto text-amber-400 font-bold text-sm">
                  Card #{winnerCard.card_number}
                </div>
              )}
            </div>
            {winnerCard && (
              <BingoCardDisplay card={winnerCard.card_data} calledNumbers={numbers} cardNumber={winnerCard.card_number} compact />
            )}
          </div>
        )}

        {/* Winner's own card */}
        {isWinner && winnerCard && (
          <div className="bg-[#1a1035] rounded-2xl p-4 border border-amber-500/40">
            <div className="text-amber-400 text-xs font-semibold uppercase tracking-widest mb-2">Your Winning Card</div>
            <BingoCardDisplay card={winnerCard.card_data} calledNumbers={numbers} cardNumber={winnerCard.card_number} />
          </div>
        )}

        {/* Loser's own card */}
        {!isWinner && myCard && (
          <div className="bg-[#1a1035] rounded-2xl p-4 border border-purple-900/40">
            <div className="text-purple-400 text-xs font-semibold uppercase tracking-widest mb-2">Your Card</div>
            <BingoCardDisplay card={myCard.card_data} calledNumbers={numbers} cardNumber={myCard.card_number} compact />
          </div>
        )}

        {!history && (
          <div className="text-center text-purple-500 text-sm py-6">No result data available.</div>
        )}

        <button
          onClick={() => navigate('/')}
          className="w-full py-4 rounded-2xl bg-purple-600 text-white font-black text-lg"
        >
          Play Again
        </button>
      </div>

      <BottomNav />
    </div>
  )
}
