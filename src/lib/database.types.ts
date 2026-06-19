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
  stake_amount: number
  countdown_seconds: number
  countdown_started_at: string | null
  prize_pool: number
  created_at: string
  started_at: string | null
  ended_at: string | null
}

export interface LobbyPlayer {
  id: string
  lobby_id: string
  player_id: string
  joined_at: string
  auto_clicker_enabled: boolean
  auto_clicker_fee: number
  false_claim_count: number
}

export interface LobbyCard {
  id: string
  lobby_id: string
  card_number: number
  player_id: string | null
  card_data: (number | null)[][]
  taken_at: string | null
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
  card_id: string | null
  lobby_card_id: string | null
  status: ClaimStatus
  created_at: string
}

export interface GameHistory {
  id: string
  lobby_id: string
  winner_id: string | null
  winner_card_id: string | null
  prize_pool: number
  total_players: number
  balls_called: number
  ended_at: string
}

export type Database = {
  public: {
    Tables: {
      players:       { Row: Player;      Insert: Omit<Player, 'id'|'created_at'>;      Update: Partial<Player> }
      lobbies:       { Row: Lobby;       Insert: Omit<Lobby, 'id'|'created_at'>;       Update: Partial<Lobby> }
      lobby_players: { Row: LobbyPlayer; Insert: Omit<LobbyPlayer, 'id'|'joined_at'>; Update: Partial<LobbyPlayer> }
      lobby_cards:   { Row: LobbyCard;   Insert: Omit<LobbyCard, 'id'>;               Update: Partial<LobbyCard> }
      bingo_cards:   { Row: BingoCard;   Insert: Omit<BingoCard, 'id'>;               Update: Partial<BingoCard> }
      called_numbers:{ Row: CalledNumber;Insert: Omit<CalledNumber, 'id'|'called_at'>; Update: Partial<CalledNumber> }
      bingo_claims:  { Row: BingoClaim;  Insert: Omit<BingoClaim, 'id'|'created_at'>; Update: Partial<BingoClaim> }
      game_history:  { Row: GameHistory; Insert: Omit<GameHistory, 'id'|'ended_at'>;  Update: Partial<GameHistory> }
    }
  }
}
