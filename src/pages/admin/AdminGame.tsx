import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useLobby } from '../../hooks/useLobby'
import { useCalledNumbers } from '../../hooks/useCalledNumbers'
import { useBingoClaims } from '../../hooks/useBingoClaims'
import { useAuth } from '../../hooks/useAuth'
import { NumberBoard } from '../../components/NumberBoard'
import type { LobbyStatus } from '../../lib/database.types'

export function AdminGame() {
  const { id } = useParams<{ id: string }>()
  const { player } = useAuth()
  const { lobby } = useLobby(id)
  const calledNumbers = useCalledNumbers(id)
  const claims = useBingoClaims(id)
  const [playerCount, setPlayerCount] = useState(0)
  const [calling, setCalling] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase
      .from('lobby_players')
      .select('*', { count: 'exact', head: true })
      .eq('lobby_id', id)
      .then(({ count }) => setPlayerCount(count ?? 0))
  }, [id])

  if (!player?.is_admin) {
    return <div className="flex h-screen items-center justify-center text-gray-400">Access denied.</div>
  }

  async function setStatus(status: LobbyStatus) {
    if (!id) return
    const update: Partial<{ status: LobbyStatus; started_at: string; ended_at: string }> = { status }
    if (status === 'active') update.started_at = new Date().toISOString()
    if (status === 'completed') update.ended_at = new Date().toISOString()

    // Assign bingo cards when starting
    if (status === 'active') {
      const { generateCard } = await import('../../lib/bingo')
      const { data: players } = await supabase
        .from('lobby_players')
        .select('player_id')
        .eq('lobby_id', id!)
      if (players) {
        for (const lp of players) {
          await supabase.from('bingo_cards').upsert(
            { lobby_id: id!, player_id: lp.player_id, card_numbers: generateCard() },
            { onConflict: 'lobby_id,player_id' },
          )
        }
      }
    }

    await supabase.from('lobbies').update(update).eq('id', id!)
  }

  async function callNumber() {
    if (calling || !id) return
    setCalling(true)
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/call-number`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ lobby_id: id }),
    })
    setCalling(false)
  }

  async function verifyClaim(claimId: string) {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-bingo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ claim_id: claimId }),
    })
  }

  const numbers = calledNumbers.map((c) => c.number)

  return (
    <div className="min-h-screen bg-gray-50 px-4 pt-6 pb-10">
      <Link to="/admin/lobbies" className="text-sm text-gray-400 mb-4 block">← Lobbies</Link>
      <h1 className="text-xl font-bold text-gray-900 mb-1">{lobby?.title ?? '…'}</h1>
      <p className="text-sm text-gray-500 mb-4">
        {playerCount} players · {numbers.length} numbers called · status: <b>{lobby?.status}</b>
      </p>

      {/* Status controls */}
      <div className="flex flex-wrap gap-2 mb-6">
        {lobby?.status === 'waiting' && (
          <button onClick={() => setStatus('active')} className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium">
            Start Game
          </button>
        )}
        {lobby?.status === 'active' && (
          <>
            <button onClick={() => setStatus('paused')} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium">
              Pause
            </button>
            <button onClick={() => setStatus('completed')} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium">
              End Game
            </button>
          </>
        )}
        {lobby?.status === 'paused' && (
          <button onClick={() => setStatus('active')} className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium">
            Resume
          </button>
        )}
      </div>

      {/* Call number */}
      {lobby?.status === 'active' && (
        <button
          onClick={callNumber}
          disabled={calling}
          className="w-full py-4 rounded-xl bg-brand text-white font-bold text-lg mb-6 disabled:opacity-50"
        >
          {calling ? 'Calling…' : 'Call Number'}
        </button>
      )}

      <NumberBoard calledNumbers={numbers} />

      {/* Claims */}
      {claims.length > 0 && (
        <div className="mt-6">
          <h2 className="font-semibold text-gray-700 mb-3">Bingo Claims</h2>
          <div className="space-y-2">
            {claims.map((claim) => (
              <div
                key={claim.id}
                className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-3"
              >
                <div className="text-sm">
                  <span className="font-medium">{claim.player_id.slice(0, 8)}…</span>
                  <span className={[
                    'ml-2 text-xs px-2 py-0.5 rounded-full',
                    claim.status === 'verified' ? 'bg-green-100 text-green-700' :
                    claim.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700',
                  ].join(' ')}>
                    {claim.status}
                  </span>
                </div>
                {claim.status === 'pending' && (
                  <button
                    onClick={() => verifyClaim(claim.id)}
                    className="text-sm px-3 py-1 bg-brand text-white rounded-lg font-medium"
                  >
                    Verify
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
