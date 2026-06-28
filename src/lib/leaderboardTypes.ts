export type LeaderboardEntry = {
  profile_id: string
  padel_player_id?: string | null
  member_profile_id?: string | null
  player_a_id?: string | null
  player_b_id?: string | null
  player_a_name?: string | null
  player_b_name?: string | null
  player_a_avatar_url?: string | null
  player_b_avatar_url?: string | null
  is_guest?: boolean
  display_name: string
  avatar_url?: string | null
  total_points: number
  games: number
  wins?: number
  losses?: number
  draws?: number
}
