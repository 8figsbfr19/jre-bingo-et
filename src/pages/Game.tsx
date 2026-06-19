import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLobby } from '../hooks/useLobby'
import { useCalledNumbers } from '../hooks/useCalledNumbers'
import { useAuth } from '../hooks/useAuth'
import { BingoCard } from '../components/BingoCard'
import { NumberBoard } from '../components/NumberBoard'
import { ClaimBingoButton } from '../components/ClaimBingoButton'
import { checkWin } from '../lib/bingo'
import type { BingoCard as BingoCardType } from '../lib/database.types'

export function Game() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { lobby } = useLobby(id)
  const { player } = useAuth()
  const calledNumbers = useCalledNumbers(id)
  const [card, setCard] = useState<BingoCardType | null>(null)

  useEffect(() => {
    if (!id || !player) return
    supabase
      .from('bingo_cards')
      .select('*')
      .eq('lobby_id', id)
      .eq('player_id', player.id)
      .single()
      .then(({ data }) => setCard(data ?? null))
  }, [id, player])

  useEffect(() => {
    if (lobby?.status === 'completed') navigate(`/lobby/${id}`)
  }, [lobby?.status, id, navigate])

  const numbers = calledNumbers.map((c) => c.number)
  const hasWin = card ? checkWin(card.card_numbers, numbers) : false

  if (!player) return <div className="flex h-screen items-center justify-center text-gray-400">Loading…</div>

  return (
    <div className="min-h-screen bg-gray-50 px-4 pt-6 pb-10">
      <h1 className="text-xl font-bold text-gray-900 mb-4">{lobby?.title ?? 'Game'}</h1>

      <NumberBoard calledNumbers={numbers} />

      <div className="my-6">
        {card ? (
          <BingoCard card={card.card_numbers} calledNumbers={numbers} />
        ) : (
          <p className="text-center text-gray-400">Waiting for your card…</p>
        )}
      </div>

      {card && lobby?.status === 'active' && (
        <ClaimBingoButton
          lobbyId={id!}
          playerId={player.id}
          cardId={card.id}
          disabled={!hasWin}
        />
      )}

      {lobby?.status === 'paused' && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-center text-blue-700 font-medium">
          Game paused
        </div>
      )}
    </div>
  )
}
