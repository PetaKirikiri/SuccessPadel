export type SessionStatus = 'draft' | 'open' | 'locked' | 'cancelled' | 'complete'
export type GameVisibility = 'open' | 'private'
export type GameKind = 'court' | 'competition'
export type PlayerCapMode = 'strict' | 'flexible'
export type PartnershipMode = 'rotating' | 'fixed_pairs' | 'americano'
export type ScoringPreset = 'standard' | 'participation' | 'winner_takes_all' | 'custom'
export type WhoCanLog = 'admin_only' | 'roster_members' | 'any_member'
export type MatchTeam = 'a' | 'b'

export type PlaySide = 'left' | 'right' | 'both'

export type Profile = {
  id: string
  display_name: string
  avatar_url: string | null
  line_user_id: string | null
  is_admin: boolean
  created_at: string
  playtomic_number: string | null
  racket: string | null
  play_style: string | null
  preferred_side: PlaySide | null
  enjoys_fun_games: boolean
  usually_free: string | null
}

export type Season = {
  id: string
  name: string
  starts_on: string
  ends_on: string | null
  is_active: boolean
}

export type ScoringConfig = {
  win_points?: number
  loss_points?: number
  margin_bonus?: number
  margin_bonus_cap?: number
  americano_target?: number
  americano_unit?: 'points' | 'sets' | 'open'
  americano_games?: number
  break_minutes?: number
  game_minutes?: number
}

export type Court = {
  id: string
  name: string
  sort_order: number
  is_active: boolean
}

export type GameSession = {
  id: string
  season_id: string | null
  title: string
  week_number: number | null
  starts_on: string
  ends_on: string
  status: SessionStatus
  partnership_mode: PartnershipMode
  scoring_preset: ScoringPreset
  scoring_config: ScoringConfig
  who_can_log_matches: WhoCanLog
  margin_bonus_enabled: boolean
  max_players: number | null
  created_by: string | null
  court_id: string | null
  starts_at: string | null
  ends_at: string | null
  visibility: GameVisibility | null
  game_kind: GameKind
  target_players: number | null
  player_cap_mode: PlayerCapMode | null
  game_group_id: string | null
  skill_level: string | null
  gender: string | null
  rules: string | null
  competition_started_at: string | null
  competition_ended_at: string | null
  competition_concluded_at: string | null
}

export type GameSlot = {
  id: string
  session_id: string
  starts_at: string
  ends_at: string
  slot_index: number
}

export type SlotPlayer = {
  slot_id: string
  profile_id: string
  joined_at: string
  profiles?: Pick<Profile, 'id' | 'display_name'>
}

export type CourtScheduleCell = {
  slot: GameSlot
  session: GameSession
  court: Court
  players: SlotPlayer[]
  rosterCount: number
  slotSpan: number
  isSpanStart: boolean
}

export type SessionPair = {
  id: string
  session_id: string
  pair_label: string | null
  player_a_id: string
  player_b_id: string
}

export type RankMode = 'solo' | 'duos'

export type LeaderboardRow = {
  rank: number
  profile_id: string
  display_name: string
  avatar_url: string | null
  season_points: number
  level: string
  wins: number
  losses: number
  matches_played: number
  points_this_week: number
}

export type DuosLeaderboardRow = {
  rank: number
  player_a_id: string
  player_b_id: string
  display_name: string
  season_points: number
  level: string
  wins: number
  losses: number
  matches_played: number
  points_this_week: number
}

export type RecordMatchPlayer = {
  profile_id: string
  team: MatchTeam
  is_winner: boolean
  margin_bonus_earned?: boolean
}

export type MatchWithPlayers = {
  id: string
  session_id: string
  played_at: string
  score_summary: string
  notes: string | null
  match_players: {
    profile_id: string
    team: MatchTeam
    is_winner: boolean
    points_earned: number
    profiles: { display_name: string }
  }[]
}
