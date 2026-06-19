import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { BingoClaim } from '../lib/database.types'

export function useBingoClaims(lobbyId: string | undefined) {
  const [claims, setClaims] = useState<BingoClaim[]>([])

  useEffect(() => {
    if (!lobbyId) return

    supabase
      .from('bingo_claims')
      .select('*')
      .eq('lobby_id', lobbyId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setClaims(data ?? []))

    const channel = supabase
      .channel(`claims:${lobbyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bingo_claims', filter: `lobby_id=eq.${lobbyId}` },
        () => {
          supabase
            .from('bingo_claims')
            .select('*')
            .eq('lobby_id', lobbyId)
            .order('created_at', { ascending: true })
            .then(({ data }) => setClaims(data ?? []))
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [lobbyId])

  return claims
}
