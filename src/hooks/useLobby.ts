import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Lobby } from '../lib/database.types'

export function useLobby(lobbyId: string | undefined) {
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!lobbyId) return

    supabase
      .from('lobbies')
      .select('*')
      .eq('id', lobbyId)
      .single()
      .then(({ data }) => {
        setLobby(data ?? null)
        setLoading(false)
      })

    const channel = supabase
      .channel(`lobby:${lobbyId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
        (payload) => setLobby(payload.new as Lobby),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [lobbyId])

  return { lobby, loading }
}
