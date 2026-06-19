import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLobby } from '../hooks/useLobby'
import { useLobbyCards } from '../hooks/useLobbyCards'
import { useAuth } from '../hooks/useAuth'
import { useCountdown } from '../hooks/useCountdown'
import { BingoCardDisplay } from '../components/BingoCardDisplay'
import { BottomNav } from '../components/BottomNav'

export function WaitingRoom() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { lobby } = useLobby(id)
  const { cards } = useLobbyCards(id)
  const { player } = useAuth()
  const { formatted, expired } = useCountdown(lobby?.countdown_started_at ?? null, lobby?.countdown_seconds ?? 60)
  const [playerCount, setPlayerCount] = useState(0)

  const myCard = cards.find(c => c.player_id === player?.id)
  const takenCount = cards.filter(c => c.player_id !== null).length

  useEffect(() => {
    setPlayerCount(takenCount)
  }, [takenCount])

  // Go to game when lobby becomes active
  useEffect(() => {
    if (lobby?.status === 'active') navigate(`/game/${id}`)
    if (lobby?.status === 'completed') navigate(`/result/${id}`)
  }, [lobby?.status, id, navigate])

  // Ensure player is in lobby_players
  useEffect(() => {
    if (!id || !player || !myCard) return
    supabase.from('lobby_players').upsert(
      { lobby_id: id, player_id: player.id },
      { onConflict: 'lobby_id,player_id' },
    )
  }, [id, player, myCard])

  const prizePool = playerCount * (lobby?.stake_amount ?? 0)

  return (
    <div className="min-h-screen bg-[#0d0923] pb-20">
      {/* Header */}
      <div className="bg-[#1a1035] border-b border-purple-900/40 px-4 py-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-white font-bold text-lg">{lobby?.title}</h1>
          <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
            WAITING
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-purple-400">
            Stake: <span className="text-amber-400 font-semibold">{lobby?.stake_amount} ETB</span>
          </span>
          <span className="text-purple-400">
            Players: <span className="text-white font-semibold">{playerCount}</span>
          </span>
          <span className="text-purple-400">
            Pool: <span className="text-amber-400 font-semibold">{prizePool} ETB</span>
          </span>
        </div>
      </div>

      <div className="px-4 pt-6 space-y-5">
        {/* Countdown */}
        {lobby?.countdown_started_at ? (
          <div className="bg-[#1a1035] rounded-2xl p-4 text-center border border-purple-900/40">
            <div className="text-purple-400 text-xs font-semibold uppercase tracking-widest mb-1">Starts In</div>
            <div className={`text-4xl font-black font-mono ${expired ? 'text-emerald-400' : 'text-amber-400'}`}>
              {expired ? 'STARTING…' : formatted}
            </div>
          </div>
        ) : (
          <div className="bg-[#1a1035] rounded-2xl p-4 text-center border border-purple-900/40">
            <div className="text-purple-300 text-sm">Waiting for admin to start the game…</div>
            <div className="mt-2 flex justify-center gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* Player's card */}
        {myCard ? (
          <div className="bg-[#1a1035] rounded-2xl p-4 border border-purple-900/40">
            <div className="text-purple-300 text-xs font-semibold uppercase tracking-widest mb-3">Your Card</div>
            <BingoCardDisplay card={myCard.card_data} cardNumber={myCard.card_number} />
          </div>
        ) : (
          <div className="bg-[#1a1035] rounded-2xl p-4 border border-amber-500/30 text-center">
            <p className="text-amber-400 text-sm font-semibold">No card selected yet!</p>
            <button
              onClick={() => navigate(`/lobby/${id}`)}
              className="mt-3 px-6 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold"
            >
              Select a Card
            </button>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
