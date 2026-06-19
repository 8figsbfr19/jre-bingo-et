import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLobbyCards } from '../hooks/useLobbyCards'
import { useCalledNumbers } from '../hooks/useCalledNumbers'
import { useAuth } from '../hooks/useAuth'
import { BingoCardDisplay } from '../components/BingoCardDisplay'
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

  useEffect(() => {
    if (!id) return
    supabase
      .from('game_history')
      .select('*')
      .eq('lobby_id', id)
      .single()
      .then(({ data }) => {
        setHistory(data ?? null)
        if (data?.winner_id) {
          supabase.from('players').select('*').eq('id', data.winner_id).single()
            .then(({ data: p }) => setWinner(p ?? null))
        }
        if (data?.winner_card_id) {
          supabase.from('lobby_cards').select('*').eq('id', data.winner_card_id).single()
            .then(({ data: c }) => setWinnerCard(c ?? null))
        }
      })
  }, [id])

  const myCard = cards.find(c => c.player_id === player?.id)
  const numbers = calledNumbers.map(c => c.number)
  const isWinner = history?.winner_id === player?.id

  if (!history) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0d0923]">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className={`min-h-screen pb-20 ${isWinner ? 'bg-gradient-to-b from-amber-900/40 to-[#0d0923]' : 'bg-gradient-to-b from-red-900/30 to-[#0d0923]'}`}>
      {/* Result header */}
      <div className="text-center pt-10 pb-6 px-4">
        <div className="text-6xl mb-3">{isWinner ? '🏆' : '😔'}</div>
        <h1 className={`text-4xl font-black mb-2 ${isWinner ? 'text-amber-400' : 'text-red-400'}`}>
          {isWinner ? 'You Won!' : 'You Lost'}
        </h1>
        <div className="text-purple-300 text-sm">
          Prize Pool: <span className="text-amber-400 font-bold">{history.prize_pool} ETB</span>
        </div>
        <div className="text-purple-400 text-xs mt-1">
          {history.balls_called} balls called · {history.total_players} players
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Winner info (shown to losers) */}
        {!isWinner && winner && (
          <div className="bg-[#1a1035] rounded-2xl p-4 border border-red-900/40">
            <div className="text-purple-400 text-xs font-semibold uppercase tracking-widest mb-2">Winner</div>
            <div className="text-white font-bold">
              {winner.first_name ?? winner.telegram_username ?? 'Player'}
            </div>
            {winnerCard && (
              <div className="mt-3">
                <BingoCardDisplay card={winnerCard.card_data} calledNumbers={numbers} cardNumber={winnerCard.card_number} compact />
              </div>
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

        {/* Player's card (for losers) */}
        {!isWinner && myCard && (
          <div className="bg-[#1a1035] rounded-2xl p-4 border border-purple-900/40">
            <div className="text-purple-400 text-xs font-semibold uppercase tracking-widest mb-2">Your Card</div>
            <BingoCardDisplay card={myCard.card_data} calledNumbers={numbers} cardNumber={myCard.card_number} compact />
          </div>
        )}

        {/* Play again */}
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
