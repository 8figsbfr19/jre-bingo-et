import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { LobbyCard } from '../lib/database.types'

export function useLobbyCards(lobbyId: string | undefined) {
  const [cards, setCards] = useState<LobbyCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!lobbyId) return

    supabase
      .from('lobby_cards')
      .select('*')
      .eq('lobby_id', lobbyId)
      .order('card_number', { ascending: true })
      .then(({ data }) => {
        setCards(data ?? [])
        setLoading(false)
      })

    const channel = supabase
      .channel(`lobby_cards:${lobbyId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'lobby_cards', filter: `lobby_id=eq.${lobbyId}` },
        (payload) => {
          setCards(prev =>
            prev.map(c => (c.id === payload.new.id ? (payload.new as LobbyCard) : c)),
          )
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [lobbyId])

  return { cards, loading }
}
