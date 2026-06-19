import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLobby } from '../hooks/useLobby'
import { useCalledNumbers } from '../hooks/useCalledNumbers'
import { useLobbyCards } from '../hooks/useLobbyCards'
import { useAuth } from '../hooks/useAuth'
import { BingoCardDisplay } from '../components/BingoCardDisplay'
import { checkWin, columnLetter } from '../lib/bingo'
import type { LobbyCard } from '../lib/database.types'

export function GameRoom() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { lobby } = useLobby(id)
  const calledNumbers = useCalledNumbers(id)
  const { cards } = useLobbyCards(id)
  const { player } = useAuth()

  const [myCard, setMyCard] = useState<LobbyCard | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [lastNum, setLastNum] = useState<number | null>(null)
  const [prevCount, setPrevCount] = useState(0)

  // Find player's card
  useEffect(() => {
    if (!player || cards.length === 0) return
    const mine = cards.find(c => c.player_id === player.id)
    if (mine) setMyCard(mine)
  }, [cards, player])

  // Animate new number
  useEffect(() => {
    if (calledNumbers.length > prevCount) {
      setLastNum(calledNumbers[calledNumbers.length - 1].number)
      setPrevCount(calledNumbers.length)
    }
  }, [calledNumbers, prevCount])

  // Navigate on game end
  useEffect(() => {
    if (lobby?.status === 'completed') {
      setTimeout(() => navigate(`/result/${id}`), 1500)
    }
  }, [lobby?.status, id, navigate])

  const numbers = calledNumbers.map(c => c.number)
  const hasWin = myCard ? checkWin(myCard.card_data, numbers) : false

  async function claimBingo() {
    if (!player || !id || !myCard || claiming || claimed) return
    setClaiming(true)

    await supabase.from('bingo_claims').insert({
      lobby_id: id,
      player_id: player.id,
      lobby_card_id: myCard.id,
      status: 'pending',
    })

    setClaiming(false)
    setClaimed(true)
  }

  const currentNum = lastNum ?? (numbers.length > 0 ? numbers[numbers.length - 1] : null)

  return (
    <div className="min-h-screen bg-[#0d0923] pb-6">
      {/* Top bar */}
      <div className="bg-[#1a1035] border-b border-purple-900/40 px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-sm">{lobby?.title}</div>
          <div className="text-purple-400 text-xs">{numbers.length} numbers called</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-purple-400">Prize Pool</div>
          <div className="text-amber-400 font-black">{lobby?.prize_pool ?? 0} ETB</div>
        </div>
      </div>

      {/* Current number ball */}
      <div className="flex justify-center py-6">
        {currentNum ? (
          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-purple-600 to-purple-900 border-4 border-purple-400 shadow-lg shadow-purple-900 flex flex-col items-center justify-center">
              <span className="text-purple-300 text-sm font-bold">{columnLetter(currentNum)}</span>
              <span className="text-white text-5xl font-black leading-none">{currentNum}</span>
            </div>
          </div>
        ) : (
          <div className="w-28 h-28 rounded-full bg-[#1a1035] border-2 border-purple-800 flex items-center justify-center">
            <span className="text-purple-600 text-sm">Waiting…</span>
          </div>
        )}
      </div>

      {/* Called numbers board — compact 75-cell grid */}
      <div className="px-4 mb-4">
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(15, 1fr)' }}>
          {Array.from({ length: 75 }, (_, i) => i + 1).map(n => {
            const isCalled = numbers.includes(n)
            const isCurrent = n === currentNum
            return (
              <div
                key={n}
                className={[
                  'aspect-square flex items-center justify-center text-[9px] font-bold rounded',
                  isCurrent
                    ? 'bg-amber-500 text-white'
                    : isCalled
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#1a1035] text-purple-700',
                ].join(' ')}
              >
                {n}
              </div>
            )
          })}
        </div>
      </div>

      {/* Player's bingo card */}
      <div className="px-4 mb-4">
        <div className="bg-[#1a1035] rounded-2xl p-4 border border-purple-900/40">
          {myCard ? (
            <BingoCardDisplay card={myCard.card_data} calledNumbers={numbers} cardNumber={myCard.card_number} />
          ) : (
            <p className="text-purple-500 text-center text-sm">No card assigned.</p>
          )}
        </div>
      </div>

      {/* BINGO button */}
      {myCard && lobby?.status === 'active' && (
        <div className="px-4">
          {claimed ? (
            <div className="w-full py-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-center text-emerald-400 font-bold text-lg">
              BINGO claimed! Waiting for verification…
            </div>
          ) : (
            <button
              onClick={claimBingo}
              disabled={!hasWin || claiming}
              className={[
                'w-full py-4 rounded-2xl text-xl font-black tracking-wider transition-all active:scale-95',
                hasWin
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-white shadow-lg shadow-amber-900 animate-pulse'
                  : 'bg-[#1a1035] text-purple-800 cursor-not-allowed border border-purple-900',
              ].join(' ')}
            >
              {claiming ? 'Claiming…' : 'BINGO!'}
            </button>
          )}
          {!hasWin && !claimed && (
            <p className="text-center text-purple-600 text-xs mt-2">Complete a row, column or diagonal to claim</p>
          )}
        </div>
      )}

      {lobby?.status === 'paused' && (
        <div className="mx-4 py-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-center text-blue-400 font-semibold">
          Game paused
        </div>
      )}

      {lobby?.status === 'completed' && (
        <div className="mx-4 py-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-center text-purple-300 font-semibold">
          Game over — loading results…
        </div>
      )}
    </div>
  )
}
