import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLobby } from '../hooks/useLobby'
import { useCalledNumbers } from '../hooks/useCalledNumbers'
import { useLobbyCards } from '../hooks/useLobbyCards'
import { useAuth } from '../hooks/useAuth'
import { BingoCardDisplay } from '../components/BingoCardDisplay'
import { checkWin, columnLetter } from '../lib/bingo'
import { formatDate, displayName } from '../lib/utils'
import type { LobbyCard } from '../lib/database.types'

type ClaimState = 'idle' | 'submitting' | 'pending' | 'verified' | 'rejected_valid' | 'false_claim'

interface ResultOverlay {
  isWinner: boolean
  winnerName: string
  winnerCardNumber: number | null
  winnerCardData: (number | null)[][] | null
  prizePool: number
  endedAt: string
}

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
  const [autoMark, setAutoMark] = useState(true)
  const [manuallyMarked, setManuallyMarked] = useState(new Set<number>())
  const [showFalseClaimModal, setShowFalseClaimModal] = useState(false)
  const [animNum, setAnimNum] = useState<number | null>(null)
  const [prevCount, setPrevCount] = useState(0)
  const [overlay, setOverlay] = useState<ResultOverlay | null>(null)
  const [overlayDismissed, setOverlayDismissed] = useState(false)

  // Resolve player's card
  useEffect(() => {
    if (!player || cards.length === 0) return
    const mine = cards.find(c => c.player_id === player.id)
    if (mine) setMyCard(mine)
  }, [cards, player])

  // Load lobby_players row: kicked status + auto_clicker_enabled
  useEffect(() => {
    if (!id || !player) return
    supabase
      .from('lobby_players')
      .select('status, auto_clicker_enabled')
      .eq('lobby_id', id)
      .eq('player_id', player.id)
      .single()
      .then(({ data }) => {
        if (data?.status === 'kicked') setIsKicked(true)
        if (data?.auto_clicker_enabled === false) setAutoMark(false)
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

  // Winner overlay when lobby completes
  useEffect(() => {
    if (lobby?.status !== 'completed' || overlayDismissed) return

    async function loadResult() {
      const { data: gh } = await supabase
        .from('game_history').select('*').eq('lobby_id', id!).single()
      if (!gh) return

      const [{ data: wp }, { data: wc }] = await Promise.all([
        gh.winner_id
          ? supabase.from('players').select('first_name, telegram_username').eq('id', gh.winner_id).single()
          : Promise.resolve({ data: null }),
        gh.winner_card_id
          ? supabase.from('lobby_cards').select('card_number, card_data').eq('id', gh.winner_card_id).single()
          : Promise.resolve({ data: null }),
      ])

      setOverlay({
        isWinner: gh.winner_id === player?.id,
        winnerName: displayName(wp),
        winnerCardNumber: wc?.card_number ?? null,
        winnerCardData: wc?.card_data ?? null,
        prizePool: gh.prize_pool,
        endedAt: gh.ended_at,
      })
    }

    // Small delay to let game_history be written
    setTimeout(loadResult, 1000)
  }, [lobby?.status, id, player, overlayDismissed])

  const numbers = calledNumbers.map(c => c.number)
  const currentNum = numbers[numbers.length - 1] ?? null
  // Win check always uses server-authoritative called numbers
  const hasWin = myCard ? checkWin(myCard.card_data, numbers) : false

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
    if (!hasWin && !force) { setShowFalseClaimModal(true); return }
    setClaimState('submitting')

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ lobby_id: id, lobby_card_id: myCard.id }),
    })

    const json = await res.json()
    if (!res.ok || json.error) { setClaimState('idle'); return }
    if (json.valid === false) { setClaimState('false_claim'); setIsKicked(true) }
    else setClaimState('pending')
  }

  return (
    <div className="min-h-screen bg-[#0d0923] pb-6">
      {/* Top bar */}
      <div className="bg-[#1a1035] border-b border-purple-900/40 px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-sm">{lobby?.title}</div>
          <div className="text-purple-400 text-xs">{numbers.length} / 75 called</div>
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
                autoMark={autoMark}
              />
              {!isKicked && (
                <p className="text-purple-700 text-[10px] text-center mt-1">
                  {autoMark
                    ? 'Auto Clicker ON — called numbers marked automatically'
                    : 'Auto Clicker OFF — tap called numbers manually'}
                </p>
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
              <button onClick={() => navigate('/')}
                className="flex-1 py-2.5 rounded-xl border border-purple-700 text-purple-300 font-semibold text-sm">
                Back to Lobbies
              </button>
              <button onClick={() => {/* stay on page to watch */}}
                className="flex-1 py-2.5 rounded-xl bg-purple-900/60 text-purple-300 font-semibold text-sm">
                Watch Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BINGO claim area */}
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
                <button onClick={() => submitClaim(false)}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 text-white font-black text-2xl tracking-widest shadow-lg shadow-amber-900/50 animate-pulse active:scale-95 transition-transform">
                  BINGO!
                </button>
              ) : (
                <button onClick={() => submitClaim(false)}
                  className="w-full py-3 rounded-2xl bg-[#1a1035] border border-purple-800 text-purple-500 font-semibold text-base">
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

      {/* False claim warning modal */}
      {showFalseClaimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6">
          <div className="bg-[#1a1035] rounded-2xl p-6 w-full max-w-sm border border-red-900/40">
            <div className="text-3xl text-center mb-3">⚠️</div>
            <h2 className="text-white font-black text-lg text-center mb-2">Are you sure?</h2>
            <p className="text-purple-300 text-sm text-center mb-4">
              You don't appear to have a complete BINGO yet. A false claim will remove you from this lobby.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowFalseClaimModal(false)}
                className="flex-1 py-3 rounded-xl border border-purple-700 text-purple-300 font-semibold">Cancel</button>
              <button onClick={() => { setShowFalseClaimModal(false); submitClaim(true) }}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold">Claim Anyway</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Winner announcement overlay ───────────────────────────────────── */}
      {overlay && !overlayDismissed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4">
          <div className={`w-full max-w-sm rounded-3xl overflow-hidden ${overlay.isWinner ? 'bg-gradient-to-b from-amber-900/80 to-[#1a1035]' : 'bg-gradient-to-b from-red-950/80 to-[#1a1035]'} border ${overlay.isWinner ? 'border-amber-500/30' : 'border-red-900/30'}`}>
            {/* Close button */}
            <div className="flex justify-end px-4 pt-4">
              <button onClick={() => setOverlayDismissed(true)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white font-bold text-lg hover:bg-white/20">
                ✕
              </button>
            </div>

            <div className="px-6 pb-6 space-y-4">
              {/* Result header */}
              <div className="text-center">
                <div className="text-5xl mb-2">{overlay.isWinner ? '🏆' : '😔'}</div>
                <h2 className={`text-3xl font-black ${overlay.isWinner ? 'text-amber-400' : 'text-red-400'}`}>
                  {overlay.isWinner ? 'You Won!' : 'You Lost'}
                </h2>
                <div className="text-white font-bold text-lg mt-1">
                  Pool: <span className="text-amber-400">{overlay.prizePool} ETB</span>
                </div>
                <div className="text-purple-400 text-xs mt-0.5">{formatDate(overlay.endedAt)}</div>
              </div>

              {/* Winner info */}
              <div className="bg-black/20 rounded-xl p-3">
                <div className="text-purple-400 text-xs uppercase tracking-widest mb-1">Winner</div>
                <div className="flex items-center justify-between">
                  <div className="text-white font-bold">{overlay.winnerName}</div>
                  {overlay.winnerCardNumber && (
                    <div className="text-amber-400 text-sm font-semibold">Card #{overlay.winnerCardNumber}</div>
                  )}
                </div>
              </div>

              {/* Winner card preview */}
              {overlay.winnerCardData && (
                <BingoCardDisplay
                  card={overlay.winnerCardData}
                  calledNumbers={numbers}
                  cardNumber={overlay.winnerCardNumber ?? undefined}
                  compact
                />
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                {!overlay.isWinner && (
                  <button
                    onClick={() => setOverlayDismissed(true)}
                    className="flex-1 py-3 rounded-xl border border-purple-700 text-purple-300 font-semibold text-sm"
                  >
                    View My Card
                  </button>
                )}
                <button
                  onClick={() => navigate(`/result/${id}`)}
                  className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-black"
                >
                  Play Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* After overlay dismissed, show Play Again bar */}
      {overlayDismissed && lobby?.status === 'completed' && (
        <div className="mx-4 mt-4">
          <button onClick={() => navigate(`/result/${id}`)}
            className="w-full py-3 rounded-2xl bg-purple-600 text-white font-black">
            View Results & Play Again
          </button>
        </div>
      )}
    </div>
  )
}
