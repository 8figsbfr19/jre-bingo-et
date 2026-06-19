import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useLobby } from '../../hooks/useLobby'
import { useCalledNumbers } from '../../hooks/useCalledNumbers'
import { useBingoClaims } from '../../hooks/useBingoClaims'
import { useAuth } from '../../hooks/useAuth'
import { columnLetter } from '../../lib/bingo'
import type { LobbyStatus } from '../../lib/database.types'

export function AdminGame() {
  const { id } = useParams<{ id: string }>()
  const { player } = useAuth()
  const { lobby } = useLobby(id)
  const calledNumbers = useCalledNumbers(id)
  const claims = useBingoClaims(id)

  const [playerCount, setPlayerCount] = useState(0)
  const [calling, setCalling] = useState(false)
  const [autoCall, setAutoCall] = useState(false)
  const [verifying, setVerifying] = useState<string | null>(null)
  const autoCallRef = useRef(autoCall)
  autoCallRef.current = autoCall

  useEffect(() => {
    if (!id) return
    supabase
      .from('lobby_players')
      .select('*', { count: 'exact', head: true })
      .eq('lobby_id', id)
      .then(({ count }) => setPlayerCount(count ?? 0))
  }, [id])

  // Auto-call interval — every 3 seconds when enabled and lobby is active
  useEffect(() => {
    if (!autoCall || lobby?.status !== 'active') return

    const interval = setInterval(async () => {
      if (!autoCallRef.current || lobby?.status !== 'active') return
      if (calledNumbers.length >= 75) {
        setAutoCall(false)
        return
      }
      await callNumber()
    }, 3000)

    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCall, lobby?.status])

  if (!player?.is_admin) {
    return <div className="flex h-screen items-center justify-center text-gray-400">Access denied.</div>
  }

  async function setStatus(status: LobbyStatus) {
    if (!id) return
    const update: Record<string, string> = { status }
    if (status === 'active') update.started_at = new Date().toISOString()
    if (status === 'completed') update.ended_at = new Date().toISOString()

    // Assign bingo cards for legacy support when starting
    if (status === 'active') {
      const { generateCard } = await import('../../lib/bingo')
      const { data: lps } = await supabase.from('lobby_players').select('player_id').eq('lobby_id', id!)
      if (lps) {
        for (const lp of lps) {
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
    if (!id) return
    setVerifying(claimId)
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-bingo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ claim_id: claimId }),
    })
    setVerifying(null)
  }

  const numbers = calledNumbers.map(c => c.number)
  const lastNum = numbers[numbers.length - 1]

  return (
    <div className="min-h-screen bg-gray-50 px-4 pt-6 pb-10">
      <Link to="/admin/lobbies" className="text-sm text-gray-400 mb-4 block">← Lobbies</Link>
      <h1 className="text-xl font-bold text-gray-900 mb-1">{lobby?.title ?? '…'}</h1>
      <p className="text-sm text-gray-500 mb-4">
        {playerCount} players · {numbers.length} called · {lobby?.stake_amount} ETB · <b>{lobby?.status}</b>
      </p>

      {/* Last called number */}
      {lastNum && (
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 rounded-full bg-purple-600 flex flex-col items-center justify-center shadow-lg">
            <span className="text-purple-300 text-xs font-bold">{columnLetter(lastNum)}</span>
            <span className="text-white text-3xl font-black leading-none">{lastNum}</span>
          </div>
        </div>
      )}

      {/* Status controls */}
      <div className="flex flex-wrap gap-2 mb-4">
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

      {/* Call number controls */}
      {lobby?.status === 'active' && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={callNumber}
            disabled={calling}
            className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold disabled:opacity-50"
          >
            {calling ? 'Calling…' : 'Call Number'}
          </button>
          <button
            onClick={() => setAutoCall(!autoCall)}
            className={`px-4 py-3 rounded-xl font-bold text-sm border transition-colors ${
              autoCall
                ? 'bg-amber-500 text-white border-amber-500'
                : 'border-purple-300 text-purple-600'
            }`}
          >
            {autoCall ? 'Auto ON' : 'Auto OFF'}
          </button>
        </div>
      )}

      {/* Called numbers grid */}
      <div className="grid gap-1 mb-6" style={{ gridTemplateColumns: 'repeat(15, 1fr)' }}>
        {Array.from({ length: 75 }, (_, i) => i + 1).map(n => (
          <div
            key={n}
            className={[
              'aspect-square flex items-center justify-center text-[9px] font-bold rounded',
              n === lastNum ? 'bg-amber-500 text-white' :
              numbers.includes(n) ? 'bg-green-400 text-white' :
              'bg-gray-100 text-gray-500',
            ].join(' ')}
          >
            {n}
          </div>
        ))}
      </div>

      {/* Bingo claims */}
      {claims.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-700 mb-3">Bingo Claims ({claims.length})</h2>
          <div className="space-y-2">
            {claims.map(claim => (
              <div key={claim.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-3">
                <div className="text-sm">
                  <span className="font-medium">{claim.player_id.slice(0, 8)}…</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                    claim.status === 'verified' ? 'bg-green-100 text-green-700' :
                    claim.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {claim.status}
                  </span>
                </div>
                {claim.status === 'pending' && (
                  <button
                    onClick={() => verifyClaim(claim.id)}
                    disabled={verifying === claim.id}
                    className="text-sm px-3 py-1 bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50"
                  >
                    {verifying === claim.id ? '…' : 'Verify'}
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
