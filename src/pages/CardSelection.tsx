import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLobby } from '../hooks/useLobby'
import { useLobbyCards } from '../hooks/useLobbyCards'
import { useAuth } from '../hooks/useAuth'
import { BingoCardDisplay } from '../components/BingoCardDisplay'
import type { LobbyCard } from '../lib/database.types'

export function CardSelection() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { lobby } = useLobby(id)
  const { cards, loading } = useLobbyCards(id)
  const { player } = useAuth()

  const [preview, setPreview] = useState<LobbyCard | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [myCardNumber, setMyCardNumber] = useState<number | null>(null)
  const [autoClicker, setAutoClicker] = useState(true)

  const stake = lobby?.stake_amount ?? 0
  const autoClickerFee = autoClicker ? 0.10 : 0
  const total = stake + autoClickerFee

  useEffect(() => {
    if (!player || cards.length === 0) return
    const mine = cards.find(c => c.player_id === player.id)
    if (mine) setMyCardNumber(mine.card_number)
  }, [cards, player])

  useEffect(() => {
    if (lobby?.status === 'active') navigate(`/game/${id}`)
    if (lobby?.status === 'completed') navigate('/')
  }, [lobby?.status, id, navigate])

  async function confirmCard(card: LobbyCard) {
    if (!player || !id || confirming) return
    setConfirming(true)

    // Claim the card
    const { error: claimErr } = await supabase
      .from('lobby_cards')
      .update({ player_id: player.id, taken_at: new Date().toISOString() })
      .eq('id', card.id)
      .is('player_id', null)

    if (claimErr) {
      alert('That card was just taken — please pick another.')
      setConfirming(false)
      setPreview(null)
      return
    }

    // Join lobby_players with auto-clicker preference
    await supabase.from('lobby_players').upsert(
      {
        lobby_id: id,
        player_id: player.id,
        auto_clicker_enabled: autoClicker,
        auto_clicker_fee: autoClicker ? 0.10 : 0,
      },
      { onConflict: 'lobby_id,player_id' },
    )

    // Set countdown_started_at if this is the first player
    if (!lobby?.countdown_started_at) {
      await supabase
        .from('lobbies')
        .update({ countdown_started_at: new Date().toISOString() })
        .eq('id', id)
        .is('countdown_started_at', null)
    }

    setConfirming(false)
    navigate(`/lobby/${id}/waiting`)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0d0923]">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0d0923] pb-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0d0923]/95 backdrop-blur border-b border-purple-900/40 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="text-purple-400 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-white font-bold text-base">{lobby?.title}</h1>
          <p className="text-purple-400 text-xs">
            Stake: <span className="text-amber-400 font-semibold">{stake} ETB</span>
            {myCardNumber && <span className="ml-2 text-emerald-400">· Card #{myCardNumber} selected</span>}
          </p>
        </div>
      </div>

      {/* Already have a card */}
      {myCardNumber ? (
        <div className="px-4 pt-6 space-y-3">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-center">
            <div className="text-emerald-400 font-bold text-lg">Card #{myCardNumber} Reserved</div>
            <p className="text-purple-300 text-sm mt-1">You've already selected your card for this lobby.</p>
          </div>
          <button
            onClick={() => navigate(`/lobby/${id}/waiting`)}
            className="w-full py-4 rounded-2xl bg-purple-600 text-white font-bold text-lg"
          >
            Go to Waiting Room
          </button>
        </div>
      ) : (
        <>
          <p className="text-purple-400 text-xs text-center py-3">Tap a card number to preview it</p>
          <div className="px-3">
            <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(10, 1fr)' }}>
              {cards.map(card => {
                const isMine = card.player_id === player?.id
                const isTaken = card.player_id !== null && !isMine
                return (
                  <button
                    key={card.card_number}
                    disabled={isTaken}
                    onClick={() => !isTaken && setPreview(card)}
                    className={[
                      'aspect-square rounded-lg text-xs font-bold flex items-center justify-center transition-all active:scale-90',
                      isMine
                        ? 'bg-emerald-500 text-white ring-2 ring-emerald-300'
                        : isTaken
                        ? 'bg-[#1a1035] text-purple-800 cursor-not-allowed'
                        : 'bg-[#2a1f55] text-purple-200 hover:bg-purple-700',
                    ].join(' ')}
                  >
                    {card.card_number}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Card preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
          onClick={() => setPreview(null)}
        >
          <div
            className="bg-[#1a1035] rounded-t-3xl w-full max-w-sm p-6 pb-10"
            onClick={e => e.stopPropagation()}
          >
            <BingoCardDisplay card={preview.card_data} cardNumber={preview.card_number} />

            {/* Auto-clicker toggle */}
            <div className="mt-5 bg-[#0d0923] rounded-xl p-4 border border-purple-900/40">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-semibold text-sm">Auto Clicker</div>
                  <div className="text-purple-400 text-xs">Automatically marks your numbers</div>
                </div>
                <button
                  onClick={() => setAutoClicker(!autoClicker)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${autoClicker ? 'bg-purple-600' : 'bg-purple-900'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${autoClicker ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>
              {autoClicker && (
                <div className="text-amber-400 text-xs mt-1">+0.10 ETB (V1: placeholder)</div>
              )}
            </div>

            {/* Cost summary */}
            <div className="mt-3 bg-[#0d0923] rounded-xl px-4 py-3 border border-purple-900/40 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-purple-400">Stake</span>
                <span className="text-white font-semibold">{stake} ETB</span>
              </div>
              {autoClicker && (
                <div className="flex justify-between text-sm">
                  <span className="text-purple-400">Auto Clicker</span>
                  <span className="text-amber-400">+0.10 ETB</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t border-purple-900/40 pt-1 mt-1">
                <span className="text-white font-bold">Total</span>
                <span className="text-amber-400 font-black">{total.toFixed(2)} ETB</span>
              </div>
              <p className="text-purple-600 text-[10px]">No real payment in V1</p>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setPreview(null)}
                className="flex-1 py-3 rounded-xl border border-purple-700 text-purple-300 font-semibold"
              >
                Back
              </button>
              <button
                onClick={() => confirmCard(preview)}
                disabled={confirming}
                className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold disabled:opacity-60"
              >
                {confirming ? 'Confirming…' : 'Confirm Card'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
