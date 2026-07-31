/**
 * Competition timing architecture lock.
 * Run: npm run check:schedule
 */
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url)) + '/..'
const centralFile = 'src/lib/competitionScheduleLayout.ts'

async function load(id: string) {
  const server = await createServer({ root, logLevel: 'error' })
  try {
    await server.pluginContainer.buildStart({})
    return await server.ssrLoadModule(id)
  } finally {
    await server.close()
  }
}

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await sourceFiles(full))
    } else if (/\.(?:ts|tsx)$/.test(entry.name)) {
      files.push(full)
    }
  }
  return files
}

const schedule = await load(centralFile)
const layout = await load('src/lib/competitionLayout.ts')
const duoSchedule = await load('src/lib/duoRoundRobinSchedule.ts')
const rankedSchedule = await load('src/lib/rankedSchedule.ts')
const defaults = schedule.COMPETITION_SCHEDULE
const expectedMinutes = 6 * 15 + 5 * 4

if (
  defaults.games !== 6 ||
  defaults.gameMinutes !== 15 ||
  defaults.breakMinutes !== 4 ||
  schedule.totalScheduleMinutes(6, 15, 4) !== expectedMinutes
) {
  throw new Error('Competition schedule contract must remain 6×15 min + 5×4 min = 110 min')
}

const duoRounds = duoSchedule.duoRoundRobinRounds(8) as number[][][]
const teamOneOpponents = duoRounds.slice(0, 6).map((round) => {
  const match = round.find(([a, b]) => a === 0 || b === 0)
  if (!match) throw new Error('Every duo round must include Team 1')
  return (match[0] === 0 ? match[1] : match[0]) + 1
})
if (teamOneOpponents.join(',') !== '2,3,4,5,6,7') {
  throw new Error(
    `Six-round duo schedule must give Team 1 opponents 2–7, got ${teamOneOpponents.join(',')}`,
  )
}
if (rankedSchedule.RANKED_SCHEDULE_VERSION < 11) {
  throw new Error('Reversed duo round order requires schedule version 11 or newer')
}

const canonicalSession = {
  starts_at: '2026-07-24T11:10:00.000Z',
  ends_at: '2026-07-24T13:00:00.000Z',
  scoring_config: {},
  schedule_game_count: 6,
  schedule_game_minutes: 15,
  schedule_break_minutes: 4,
  target_players: 16,
  max_players: 16,
}
const planned = layout.competitionRoundTimesByGame(canonicalSession, 6)
if (
  planned.get(1)?.startsAt !== Date.parse('2026-07-24T11:10:00.000Z') ||
  planned.get(6)?.endsAt !== Date.parse('2026-07-24T13:00:00.000Z')
) {
  throw new Error('Canonical 18:10–20:00 schedule does not finish exactly at 20:00')
}

const savedRounds = [
  {
    round_number: 1,
    starts_at: '2026-07-24T11:14:00.000Z',
    ends_at: '2026-07-24T11:28:00.000Z',
  },
]
const live = layout.competitionRoundTimesByGame(canonicalSession, 6, savedRounds)
if (
  live.get(1)?.startsAt !== Date.parse(savedRounds[0].starts_at) ||
  live.get(1)?.endsAt !== Date.parse(savedRounds[0].ends_at)
) {
  throw new Error('Saved database round timestamps must override planned Game Card timestamps')
}

const legacyCompetitionTimingPattern = /\b(?:americano_games|game_minutes|break_minutes)\b/
const legacyFriendlyAllowlist = new Set([
  'src/lib/friendlyGames.ts',
  'src/lib/friendlyGameDisplay.ts',
  'src/components/GameCard/GameBoardPreview.tsx',
  'src/lib/types.ts',
])
const forbiddenRuntimePatterns = [
  'fitCompetitionScheduleToSession',
  'competitionSqlSchedule',
  'schedule fitted',
  'schedule retry',
]

for (const absolute of await sourceFiles(path.join(root, 'src'))) {
  const relative = path.relative(root, absolute)
  if (relative === centralFile) continue
  const source = await readFile(absolute, 'utf8')
  if (legacyCompetitionTimingPattern.test(source) && !legacyFriendlyAllowlist.has(relative)) {
    throw new Error(
      `${relative} reintroduces legacy JSON timing; use game_sessions schedule columns`,
    )
  }
  for (const forbidden of forbiddenRuntimePatterns) {
    if (source.includes(forbidden)) {
      throw new Error(`${relative} reintroduces forbidden runtime schedule mutation: ${forbidden}`)
    }
  }
}

const migrations = await readdir(path.join(root, 'supabase/migrations'))
const contractMigration = migrations
  .filter((name) => name.endsWith('_centralize_competition_schedule.sql'))
  .sort()
  .at(-1)
if (!contractMigration) throw new Error('Missing central competition schedule migration')

const sql = await readFile(path.join(root, 'supabase/migrations', contractMigration), 'utf8')
for (const required of [
  'add column if not exists schedule_game_count smallint',
  'add column if not exists schedule_game_minutes smallint',
  'add column if not exists schedule_break_minutes smallint',
  "scoring_config = coalesce(scoring_config, '{}'::jsonb)",
  "set scoring_config = v_clean_config",
  'v_session.schedule_game_count * v_session.schedule_game_minutes',
  'Schedule exceeds session time',
]) {
  if (!sql.includes(required)) {
    throw new Error(`${contractMigration} no longer enforces persisted schedule field: ${required}`)
  }
}
if (/v_session\.scoring_config->>'(?:americano_games|game_minutes|break_minutes)'/.test(sql)) {
  throw new Error(`${contractMigration} must not read timing from scoring_config at runtime`)
}

console.log('check:schedule ok')
