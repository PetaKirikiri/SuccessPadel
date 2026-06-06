import { z } from 'zod'

export const scoringConfigSchema = z.object({
  win_points: z.number().int().min(0).optional(),
  loss_points: z.number().int().min(0).optional(),
  margin_bonus: z.number().int().min(0).optional(),
  margin_bonus_cap: z.number().int().min(0).optional(),
})

export const gameSessionFormSchema = z.object({
  season_id: z.string().uuid(),
  title: z.string().min(1),
  week_number: z.number().int().optional(),
  starts_on: z.string(),
  ends_on: z.string(),
  partnership_mode: z.enum(['rotating', 'fixed_pairs', 'americano']),
  scoring_preset: z.enum(['standard', 'participation', 'winner_takes_all', 'custom']),
  scoring_config: scoringConfigSchema.default({}),
  who_can_log_matches: z.enum(['admin_only', 'roster_members', 'any_member']),
  margin_bonus_enabled: z.boolean(),
  max_players: z.number().int().positive().optional(),
  roster_ids: z.array(z.string().uuid()).min(2),
  pairs: z
    .array(
      z.object({
        pair_label: z.string().optional(),
        player_a_id: z.string().uuid(),
        player_b_id: z.string().uuid(),
      }),
    )
    .optional(),
})

export type GameSessionForm = z.infer<typeof gameSessionFormSchema>

export const courtGameFormSchema = z.object({
  court_id: z.string().uuid(),
  day: z.string(),
  start_hour: z.number().int().min(6).max(21),
  duration_hours: z.number().int().min(1).max(16),
  visibility: z.enum(['open', 'private']),
  target_players: z.number().int().min(2).max(16),
  player_cap_mode: z.enum(['strict', 'flexible']),
  max_players: z.number().int().min(2).max(16).optional(),
  slot_players: z.array(
    z.object({
      slot_index: z.number().int().min(0),
      profile_ids: z.array(z.string().uuid()).max(4),
    }),
  ),
})

export type CourtGameForm = z.infer<typeof courtGameFormSchema>

export const competitionFormSchema = z.object({
  day: z.string().min(1),
  start_hour: z.number().int().min(6).max(21),
  duration_hours: z.number().int().min(1).max(3),
  skill_level: z.enum(['Beginner', 'Low Inter', 'Intermediate', 'Advanced', 'Open']),
  gender: z.enum(['Mixed', 'Women', 'Men']),
  target_players: z.union([z.literal(4), z.literal(8), z.literal(12), z.literal(16)]),
  rule_format: z.enum(['king_of_court', 'americano']),
  partner_style: z.enum(['swapped', 'fixed']).nullable(),
  title: z.string().optional(),
  season_id: z.string().uuid(),
})

export type CompetitionFormValues = z.infer<typeof competitionFormSchema>

export function partnershipLabel(mode: string): string {
  switch (mode) {
    case 'fixed_pairs':
      return 'Fixed pairs'
    case 'americano':
      return 'Americano'
    default:
      return 'Rotating'
  }
}

export function scoringLabel(preset: string): string {
  switch (preset) {
    case 'participation':
      return 'Participation'
    case 'winner_takes_all':
      return 'Winner takes all'
    case 'custom':
      return 'Custom'
    default:
      return 'Standard 3/1'
  }
}
