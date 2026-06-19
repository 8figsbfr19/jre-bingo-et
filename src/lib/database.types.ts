export type LobbyStatus = 'waiting' | 'active' | 'paused' | 'completed'
export type ClaimStatus = 'pending' | 'verified' | 'rejected'

export interface Player {
  id: string
  telegram_id: number
  telegram_username: string | null
  first_name: string | null
  last_name: string | null
  is_admin: boolean
  created_at: string
}

export interface Lobby {
  id: string
  title: string
  max_players: number
  status: LobbyStatus
  created_at: string
  started_at: string | null
  ended_at: string | null
}

export interface LobbyPlayer {
  id: string
  lobby_id: string
  player_id: string
  joined_at: string
}

export interface BingoCard {
  id: string
  lobby_id: string
  player_id: string
  card_numbers: (number | null)[][]
}

export interface CalledNumber {
  id: string
  lobby_id: string
  number: number
  called_at: string
}

export interface BingoClaim {
  id: string
  lobby_id: string
  player_id: string
  card_id: string
  status: ClaimStatus
  created_at: string
}

// Minimal Database generic for createClient typing
export type Database = {
  public: {
    Tables: {
      players: { Row: Player; Insert: Omit<Player, 'id' | 'created_at'>; Update: Partial<Player> }
      lobbies: { Row: Lobby; Insert: Omit<Lobby, 'id' | 'created_at'>; Update: Partial<Lobby> }
      lobby_players: { Row: LobbyPlayer; Insert: Omit<LobbyPlayer, 'id' | 'joined_at'>; Update: Partial<LobbyPlayer> }
      bingo_cards: { Row: BingoCard; Insert: Omit<BingoCard, 'id'>; Update: Partial<BingoCard> }
      called_numbers: { Row: CalledNumber; Insert: Omit<CalledNumber, 'id' | 'called_at'>; Update: Partial<CalledNumber> }
      bingo_claims: { Row: BingoClaim; Insert: Omit<BingoClaim, 'id' | 'created_at'>; Update: Partial<BingoClaim> }
    }
  }
}
