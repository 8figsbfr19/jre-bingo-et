import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLobby } from '../hooks/useLobby'
import { useCalledNumbers } from '../hooks/useCalledNumbers'
import { useLobbyCards } from '../hooks/useLobbyCards'
import { useAuth } from '../hooks/useAuth'
import { BingoCardDisplay } from '../components/BingoCardDisplay'
import { checkWin, columnLetter } from '../lib/bingo'
import type { LobbyCard } from '../lib/database.types'

type ClaimState = 'idle' | 'submitting' | 'pending' | 'verified' | 'rejected_valid' | 'false_claim'

export function GameRoom() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { lobby } = useLobby(id)
  const calledNumbers = useCalledNumbers(id)
  const { cards } = useLobbyCards(id)
  const { player } = useAuth()

  const [myCard, setMyCard] = useState<LobbyCard | null>(null)
  const [claimState, setClaimState] = useState<ClaimState>('idle')
  const [isKicked, setIsKicked] = useState(false)
  const [manuallyMarked, setManuallyMarked] = useState(new Set<number>())
  const [showFalseClaimModal, setShowFalseClaimModal] = useState(false)
  const [animNum, setAnimNum] = useState<number | null>(null)
  const [prevCount, setPrevCount] = useState(0)

  // Resolve player's card
  useEffect(() => {
    if (!player || cards.length === 0) return
    const mine = cards.find(c => c.player_id === player.id)
    if (mine) setMyCard(mine)
  }, [cards, player])

  // Check if player is already kicked on mount
  useEffect(() => {
    if (!id || !player) return
    supabase
      .from('lobby_players')
      .select('status')
      .eq('lobby_id', id)
      .eq('player_id', player.id)
      .single()
      .then(({ data }) => {
        if (data?.status === 'kicked') setIsKicked(true)
      })
  }, [id, player])

  // Realtime: watch own claim status
  useEffect(() => {
    if (!id || !player) return
    const ch = supabase
      .channel(`my_claim_${id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'bingo_claims',
        filter: `lobby_id=eq.${id}`,
      }, (payload) => {
        if (payload.new.player_id !== player.id) return
        const status = payload.new.status as string
        if (status === 'verified') setClaimState('verified')
        if (status === 'rejected') {
          // Admin rejected a valid claim → kick
          setClaimState('rejected_valid')
          setIsKicked(true)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id, player])

  // Animate newest number
  useEffect(() => {
    if (calledNumbers.length > prevCount) {
      const n = calledNumbers[calledNumbers.length - 1].number
      setAnimNum(n)
      setPrevCount(calledNumbers.length)
      setTimeout(() => setAnimNum(null), 1200)
    }
  }, [calledNumbers, prevCount])

  // Navigate to result when lobby completes
  useEffect(() => {
    if (lobby?.status === 'completed') {
      setTimeout(() => navigate(`/result/${id}`), 2000)
    }
  }, [lobby?.status, id, navigate])

  const numbers = calledNumbers.map(c => c.number)
  const hasWin = myCard ? checkWin(myCard.card_data, numbers) : false
  const currentNum = numbers[numbers.length - 1] ?? null

  const handleCellTap = useCallback((num: number | null) => {
    if (num === null) return
    setManuallyMarked(prev => {
      const next = new Set(prev)
      next.has(num) ? next.delete(num) : next.add(num)
      return next
    })
  }, [])

  async function submitClaim(force = false) {
    if (!player || !id || !myCard) return
    if (claimState !== 'idle') return

    if (!hasWin && !force) {
      setShowFalseClaimModal(true)
      return
    }

    setClaimState('submitting')

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ lobby_id: id, lobby_card_id: myCard.id }),
    })

    const json = await res.json()

    if (!res.ok || json.error) {
      setClaimState('idle')
      return
    }

    if (json.valid === false) {
      setClaimState('false_claim')
      setIsKicked(true)
    } else {
      setClaimState('pending')
    }
  }

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
      <div className="flex justify-center py-5">
        {currentNum ? (
          <div className={`w-28 h-28 rounded-full bg-gradient-to-br from-purple-600 to-purple-900 border-4 border-purple-400 shadow-lg flex flex-col items-center justify-center transition-transform duration-300 ${animNum === currentNum ? 'scale-110' : 'scale-100'}`}>
            <span className="text-purple-300 text-sm font-bold">{columnLetter(currentNum)}</span>
            <span className="text-white text-5xl font-black leading-none">{currentNum}</span>
          </div>
        ) : (
          <div className="w-28 h-28 rounded-full bg-[#1a1035] border-2 border-purple-800 flex items-center justify-center">
            <span className="text-purple-600 text-sm">Waiting…</span>
          </div>
        )}
      </div>

      {/* 75-number board */}
      <div className="px-3 mb-4">
        <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(15, 1fr)' }}>
          {Array.from({ length: 75 }, (_, i) => i + 1).map(n => (
            <div key={n} className={[
              'aspect-square flex items-center justify-center text-[9px] font-bold rounded',
              n === currentNum ? 'bg-amber-500 text-white' :
              numbers.includes(n) ? 'bg-emerald-600 text-white' : 'bg-[#1a1035] text-purple-700',
            ].join(' ')}>{n}</div>
          ))}
        </div>
      </div>

      {/* Player's card */}
      <div className="px-4 mb-4">
        <div className={`bg-[#1a1035] rounded-2xl p-4 border ${isKicked ? 'border-red-900/40 opacity-60' : 'border-purple-900/40'}`}>
          {myCard ? (
            <>
              <BingoCardDisplay
                card={myCard.card_data}
                calledNumbers={numbers}
                manuallyMarked={!isKicked ? manuallyMarked : undefined}
                onCellTap={!isKicked ? handleCellTap : undefined}
                cardNumber={myCard.card_number}
              />
              {!isKicked && (
                <p className="text-purple-600 text-[10px] text-center mt-1">Tap numbers to mark them manually</p>
              )}
            </>
          ) : (
            <p className="text-purple-500 text-center text-sm py-4">No card assigned.</p>
          )}
        </div>
      </div>

      {/* Kicked state */}
      {isKicked && (
        <div className="mx-4 mb-4">
          <div className={`rounded-2xl p-5 text-center border ${claimState === 'false_claim' ? 'bg-red-950/40 border-red-800/40' : 'bg-orange-950/40 border-orange-800/40'}`}>
            <div className="text-3xl mb-2">{claimState === 'false_claim' ? '🚫' : '⚠️'}</div>
            <div className={`font-black text-lg mb-1 ${claimState === 'false_claim' ? 'text-red-400' : 'text-orange-400'}`}>
              {claimState === 'false_claim' ? 'False Claim — Removed' : 'Claim Rejected'}
            </div>
            <p className="text-purple-300 text-sm mb-4">
              {claimState === 'false_claim'
                ? 'No valid BINGO pattern was found. You have been removed from this lobby.'
                : 'Admin rejected your claim. You have been removed from this lobby.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/')}
                className="flex-1 py-2.5 rounded-xl border border-purple-700 text-purple-300 font-semibold text-sm"
              >
                Back to Lobbies
              </button>
              <button
                onClick={() => {}}
                className="flex-1 py-2.5 rounded-xl bg-purple-900/60 text-purple-300 font-semibold text-sm"
              >
                Watch Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BINGO claim area — only when not kicked and game is active */}
      {!isKicked && myCard && lobby?.status === 'active' && (
        <div className="px-4 space-y-2">
          {claimState === 'verified' && (
            <div className="w-full py-4 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-center text-amber-400 font-black text-xl animate-pulse">
              🏆 BINGO Verified! You Won!
            </div>
          )}

          {claimState === 'pending' && (
            <div className="w-full py-4 rounded-2xl bg-purple-500/20 border border-purple-500/30 text-center">
              <div className="text-purple-300 font-semibold">BINGO submitted</div>
              <div className="text-purple-500 text-xs mt-1">Waiting for admin verification…</div>
            </div>
          )}

          {claimState === 'idle' && (
            <>
              {hasWin ? (
                <button
                  onClick={() => submitClaim(false)}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 text-white font-black text-2xl tracking-widest shadow-lg shadow-amber-900/50 animate-pulse active:scale-95 transition-transform"
                >
                  BINGO!
                </button>
              ) : (
                <button
                  onClick={() => submitClaim(false)}
                  className="w-full py-3 rounded-2xl bg-[#1a1035] border border-purple-800 text-purple-500 font-semibold text-base"
                >
                  I have BINGO
                </button>
              )}
              {!hasWin && (
                <p className="text-center text-purple-700 text-xs">Complete a row, column or diagonal to activate BINGO</p>
              )}
            </>
          )}

          {claimState === 'submitting' && (
            <div className="w-full py-4 rounded-2xl bg-[#1a1035] border border-purple-800 text-center text-purple-400 font-semibold">
              Verifying…
            </div>
          )}
        </div>
      )}

      {lobby?.status === 'paused' && !isKicked && (
        <div className="mx-4 py-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-center text-blue-400 font-semibold">
          Game paused
        </div>
      )}

      {lobby?.status === 'completed' && (
        <div className="mx-4 py-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-center text-purple-300 font-semibold">
          Game over — loading results…
        </div>
      )}

      {/* False claim warning modal */}
      {showFalseClaimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6">
          <div className="bg-[#1a1035] rounded-2xl p-6 w-full max-w-sm border border-red-900/40">
            <div className="text-3xl text-center mb-3">⚠️</div>
            <h2 className="text-white font-black text-lg text-center mb-2">Are you sure?</h2>
            <p className="text-purple-300 text-sm text-center mb-4">
              You don't appear to have a complete BINGO yet. The server will verify your claim. A false claim will remove you from this lobby.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowFalseClaimModal(false)}
                className="flex-1 py-3 rounded-xl border border-purple-700 text-purple-300 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowFalseClaimModal(false); submitClaim(true) }}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold"
              >
                Claim Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
