import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useLobby } from '../../hooks/useLobby'
import { useCalledNumbers } from '../../hooks/useCalledNumbers'
import { useAuth } from '../../hooks/useAuth'
import { columnLetter, detectWinningPattern } from '../../lib/bingo'
import { formatDate, displayName } from '../../lib/utils'
import type { LobbyStatus } from '../../lib/database.types'
import { BingoCardDisplay } from '../../components/BingoCardDisplay'

interface EnrichedClaim {
  id: string
  player_id: string
  player_name: string
  card_number?: number
  card_data?: (number | null)[][]
  lobby_card_id: string | null
  status: string
  created_at: string
  winning_patterns: string[]
}

interface LobbyPlayerRow {
  id: string
  player_id: string
  player_name: string
  card_number?: number
  joined_at: string
  false_claim_count: number
  status: string
}

export function AdminGame() {
  const { id } = useParams<{ id: string }>()
  const { player } = useAuth()
  const { lobby } = useLobby(id)
  const calledNumbers = useCalledNumbers(id)

  const [calling, setCalling] = useState(false)
  const [autoCall, setAutoCall] = useState(false)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [enrichedClaims, setEnrichedClaims] = useState<EnrichedClaim[]>([])
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayerRow[]>([])
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null)

  const autoCallRef = useRef(autoCall)
  const lobbyStatusRef = useRef(lobby?.status)
  autoCallRef.current = autoCall
  lobbyStatusRef.current = lobby?.status

  const numbers = calledNumbers.map(c => c.number)
  const lastNum = numbers[numbers.length - 1]

  // ── Live player list — fetched regardless of lobby status ────────────────
  useEffect(() => {
    if (!id) return

    async function fetchPlayers() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: lpData } = await (supabase as any)
        .from('lobby_players')
        .select('id, player_id, false_claim_count, status, joined_at, players(first_name, telegram_username)')
        .eq('lobby_id', id!)
        .order('joined_at', { ascending: true })

      // Also fetch card numbers for each player
      const { data: cardData } = await supabase
        .from('lobby_cards')
        .select('player_id, card_number')
        .eq('lobby_id', id!)
        .not('player_id', 'is', null)

      const cardMap: Record<string, number> = Object.fromEntries(
        (cardData ?? []).map(c => [c.player_id, c.card_number]),
      )

      setLobbyPlayers(
        (lpData ?? []).map((lp: Record<string, unknown>) => ({
          id: lp.id as string,
          player_id: lp.player_id as string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          player_name: displayName(lp.players as any),
          card_number: cardMap[lp.player_id as string],
          joined_at: lp.joined_at as string,
          false_claim_count: (lp.false_claim_count as number) ?? 0,
          status: (lp.status as string) ?? 'joined',
        })),
      )
    }

    fetchPlayers()

    const ch = supabase
      .channel(`admin_lp_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobby_players', filter: `lobby_id=eq.${id}` },
        () => fetchPlayers())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobby_cards', filter: `lobby_id=eq.${id}` },
        () => fetchPlayers())
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [id])

  // ── Enrich claims ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return

    async function fetchClaims() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rawClaims } = await (supabase as any)
        .from('bingo_claims')
        .select(`
          id, player_id, lobby_card_id, status, created_at,
          players ( first_name, telegram_username ),
          lobby_card:lobby_cards!bingo_claims_lobby_card_id_fkey ( card_number, card_data )
        `)
        .eq('lobby_id', id!)
        .order('created_at', { ascending: true })

      setEnrichedClaims(
        (rawClaims ?? []).map((c: Record<string, unknown>) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cardData = (c.lobby_card as any)?.card_data as (number | null)[][] | undefined
          const patterns = cardData ? detectWinningPattern(cardData, numbers) : []
          return {
            id: c.id as string,
            player_id: c.player_id as string,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            player_name: displayName(c.players as any),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            card_number: (c.lobby_card as any)?.card_number as number | undefined,
            card_data: cardData,
            lobby_card_id: c.lobby_card_id as string | null,
            status: c.status as string,
            created_at: c.created_at as string,
            winning_patterns: patterns,
          }
        }),
      )
    }

    fetchClaims()

    const ch = supabase
      .channel(`admin_claims_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bingo_claims', filter: `lobby_id=eq.${id}` },
        () => fetchClaims())
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, numbers.length])

  // ── Auto-call interval ────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoCall || lobby?.status !== 'active') return
    const interval = setInterval(async () => {
      if (!autoCallRef.current || lobbyStatusRef.current !== 'active') return
      if (numbers.length >= 75) { setAutoCall(false); return }
      await callNumber()
    }, 3000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCall, lobby?.status])

  if (!player?.is_admin) {
    return <div className="flex h-screen items-center justify-center text-gray-400">Access denied.</div>
  }

  const activePlayers = lobbyPlayers.filter(p => p.status !== 'kicked')
  const prizePool = (lobby?.prize_pool && lobby.prize_pool > 0)
    ? lobby.prize_pool
    : activePlayers.length * (lobby?.stake_amount ?? 0)

  async function setStatus(status: LobbyStatus) {
    if (!id) return
    const update: Record<string, unknown> = { status }

    if (status === 'active') {
      update.started_at = new Date().toISOString()
      // Prize pool = non-kicked players × stake
      const confirmedCount = activePlayers.length
      update.prize_pool = confirmedCount * (lobby?.stake_amount ?? 0)

      // Legacy bingo_cards fallback
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
    if (status === 'completed') update.ended_at = new Date().toISOString()
    await supabase.from('lobbies').update(update).eq('id', id!)
  }

  async function callNumber() {
    if (calling || !id) return
    setCalling(true)
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/call-number`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ lobby_id: id }),
    })
    setCalling(false)
  }

  async function adminVerify(claimId: string, action: 'approve' | 'reject') {
    if (!id || verifying) return
    setVerifying(claimId)
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-bingo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ claim_id: claimId, action }),
    })
    setVerifying(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 pt-6 pb-10">
      <Link to="/admin/lobbies" className="text-sm text-gray-400 mb-4 block">← Lobbies</Link>

      {/* Lobby header */}
      <h1 className="text-xl font-bold text-gray-900 mb-1">{lobby?.title ?? '…'}</h1>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-gray-500 mb-2">
        <span>Status: <b className="capitalize">{lobby?.status}</b></span>
        <span>Stake: <b>{lobby?.stake_amount} ETB</b></span>
        <span className="text-amber-600 font-semibold">Pool: {prizePool} ETB</span>
        <span>{numbers.length} / 75 called</span>
      </div>
      {lobby?.started_at && <div className="text-xs text-gray-400 mb-0.5">Started: {formatDate(lobby.started_at)}</div>}
      {lobby?.ended_at && <div className="text-xs text-gray-400 mb-2">Ended: {formatDate(lobby.ended_at)}</div>}

      {/* ── Player list (always shown) ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
          <span className="font-semibold text-gray-700 text-sm">
            Players ({activePlayers.length} confirmed{lobbyPlayers.some(p => p.status === 'kicked') ? `, ${lobbyPlayers.filter(p => p.status === 'kicked').length} kicked` : ''})
          </span>
          <span className="text-xs text-gray-400">Live</span>
        </div>
        {lobbyPlayers.length === 0 ? (
          <div className="px-4 py-5 text-center text-gray-400 text-sm">No players yet…</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {lobbyPlayers.map((lp, i) => (
              <div key={lp.id} className={`flex items-center px-4 py-2 ${lp.status === 'kicked' ? 'opacity-40' : ''}`}>
                <span className="text-gray-400 text-xs w-5 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0 ml-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-800 text-sm">{lp.player_name}</span>
                    {lp.card_number && (
                      <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded font-medium">
                        Card #{lp.card_number}
                      </span>
                    )}
                    {lp.status === 'kicked' && (
                      <span className="text-xs text-red-500 font-medium">kicked</span>
                    )}
                    {lp.false_claim_count > 0 && (
                      <span className="text-xs text-red-400">⚠ {lp.false_claim_count} false</span>
                    )}
                  </div>
                  <div className="text-gray-400 text-xs">{formatDate(lp.joined_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Status controls ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-4">
        {lobby?.status === 'waiting' && (
          <button
            onClick={() => setStatus('active')}
            disabled={activePlayers.length === 0}
            className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            Start Game{activePlayers.length > 0 ? ` (${activePlayers.length} players)` : ''}
          </button>
        )}
        {lobby?.status === 'active' && (
          <>
            <button onClick={() => setStatus('paused')}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium">Pause</button>
            <button onClick={() => setStatus('completed')}
              className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium">End Game</button>
          </>
        )}
        {lobby?.status === 'paused' && (
          <button onClick={() => setStatus('active')}
            className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium">Resume</button>
        )}
      </div>

      {/* ── Call number ───────────────────────────────────────────────────── */}
      {lobby?.status === 'active' && (
        <>
          {lastNum && (
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 rounded-full bg-purple-600 flex flex-col items-center justify-center shadow">
                <span className="text-purple-300 text-[10px] font-bold">{columnLetter(lastNum)}</span>
                <span className="text-white text-2xl font-black leading-none">{lastNum}</span>
              </div>
            </div>
          )}
          <div className="flex gap-2 mb-4">
            <button onClick={callNumber} disabled={calling}
              className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold disabled:opacity-50">
              {calling ? 'Calling…' : 'Call Number'}
            </button>
            <button onClick={() => setAutoCall(!autoCall)}
              className={`px-4 py-3 rounded-xl font-bold text-sm border transition-colors ${autoCall ? 'bg-amber-500 text-white border-amber-500' : 'border-purple-300 text-purple-600'}`}>
              Auto {autoCall ? 'ON' : 'OFF'}
            </button>
          </div>
        </>
      )}

      {/* ── 75-number grid ────────────────────────────────────────────────── */}
      {(lobby?.status === 'active' || lobby?.status === 'paused' || lobby?.status === 'completed') && (
        <div className="grid gap-1 mb-6" style={{ gridTemplateColumns: 'repeat(15, 1fr)' }}>
          {Array.from({ length: 75 }, (_, i) => i + 1).map(n => (
            <div key={n} className={[
              'aspect-square flex items-center justify-center text-[9px] font-bold rounded',
              n === lastNum ? 'bg-amber-500 text-white' :
              numbers.includes(n) ? 'bg-green-400 text-white' : 'bg-gray-100 text-gray-500',
            ].join(' ')}>{n}</div>
          ))}
        </div>
      )}

      {/* ── Claims panel ──────────────────────────────────────────────────── */}
      {enrichedClaims.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-700 mb-3">
            Bingo Claims ({enrichedClaims.filter(c => c.status === 'pending').length} pending)
          </h2>
          <div className="space-y-3">
            {enrichedClaims.map(claim => (
              <div key={claim.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-start justify-between px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800 text-sm">{claim.player_name}</span>
                      {claim.card_number && (
                        <span className="text-xs text-purple-600 font-medium bg-purple-50 px-1.5 py-0.5 rounded">
                          Card #{claim.card_number}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        claim.status === 'verified' ? 'bg-green-100 text-green-700' :
                        claim.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {claim.status === 'verified' ? '✓ Winner' : claim.status === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{formatDate(claim.created_at)}</div>
                    {claim.winning_patterns.length > 0 && (
                      <div className="text-xs text-emerald-600 font-medium mt-0.5">
                        Pattern: {claim.winning_patterns.join(', ')}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-0.5">
                      Stake: <b>{lobby?.stake_amount} ETB</b> · Pool: <b>{prizePool} ETB</b>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 ml-3 shrink-0">
                    {claim.status === 'pending' && (
                      <>
                        <button
                          onClick={() => adminVerify(claim.id, 'approve')}
                          disabled={!!verifying}
                          className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold disabled:opacity-50 whitespace-nowrap"
                        >
                          {verifying === claim.id ? '…' : '✓ Verify Winner'}
                        </button>
                        <button
                          onClick={() => adminVerify(claim.id, 'reject')}
                          disabled={!!verifying}
                          className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                        >
                          ✗ Reject
                        </button>
                      </>
                    )}
                    {claim.card_data && (
                      <button
                        onClick={() => setExpandedClaim(expandedClaim === claim.id ? null : claim.id)}
                        className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium"
                      >
                        {expandedClaim === claim.id ? 'Hide Card' : 'View Card'}
                      </button>
                    )}
                  </div>
                </div>

                {expandedClaim === claim.id && claim.card_data && (
                  <div className="px-4 pb-4 border-t border-gray-50 pt-3">
                    <BingoCardDisplay
                      card={claim.card_data}
                      calledNumbers={numbers}
                      cardNumber={claim.card_number}
                      compact
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
