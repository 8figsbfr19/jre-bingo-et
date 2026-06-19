import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface Props {
  lobbyId: string
  playerId: string
  cardId: string
  disabled?: boolean
}

export function ClaimBingoButton({ lobbyId, playerId, cardId, disabled }: Props) {
  const [loading, setLoading] = useState(false)
  const [claimed, setClaimed] = useState(false)

  async function handleClaim() {
    if (loading || claimed || disabled) return
    setLoading(true)
    const { error } = await supabase.from('bingo_claims').insert({
      lobby_id: lobbyId,
      player_id: playerId,
      card_id: cardId,
      status: 'pending',
    })
    setLoading(false)
    if (!error) setClaimed(true)
  }

  return (
    <button
      onClick={handleClaim}
      disabled={loading || claimed || disabled}
      className={[
        'w-full py-4 rounded-2xl text-xl font-bold tracking-wide transition-all',
        claimed
          ? 'bg-green-100 text-green-700 cursor-default'
          : disabled
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-brand text-white active:scale-95 shadow-md',
      ].join(' ')}
    >
      {claimed ? 'BINGO claimed!' : loading ? 'Claiming…' : 'BINGO!'}
    </button>
  )
}
