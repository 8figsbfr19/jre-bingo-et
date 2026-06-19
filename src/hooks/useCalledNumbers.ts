import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { CalledNumber } from '../lib/database.types'

export function useCalledNumbers(lobbyId: string | undefined) {
  const [calledNumbers, setCalledNumbers] = useState<CalledNumber[]>([])

  useEffect(() => {
    if (!lobbyId) return

    supabase
      .from('called_numbers')
      .select('*')
      .eq('lobby_id', lobbyId)
      .order('called_at', { ascending: true })
      .then(({ data }) => setCalledNumbers(data ?? []))

    const channel = supabase
      .channel(`called:${lobbyId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'called_numbers', filter: `lobby_id=eq.${lobbyId}` },
        (payload) => setCalledNumbers((prev) => [...prev, payload.new as CalledNumber]),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [lobbyId])

  return calledNumbers
}
