/**
 * Catches module init cycles (white screen) before they ship.
 * Run: npm run check:cycles
 */
import { createServer } from 'vite'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url)) + '/..'

async function load(id: string) {
  const server = await createServer({ root, logLevel: 'error' })
  try {
    await server.pluginContainer.buildStart({})
    return await server.ssrLoadModule(id)
  } finally {
    await server.close()
  }
}

const presets = await load('src/lib/competitionFormatPresets.ts')
const ranked = await load('src/lib/rankedSchedule.ts')
const schedule = await load('src/lib/competitionScheduleLayout.ts')
const app = await load('src/App.tsx')

if (presets.SINGLES_COMPETITION?.gameCount !== schedule.COMPETITION_SCHEDULE.games) {
  throw new Error('SINGLES_COMPETITION.gameCount not initialized — formatPresets/rankedSchedule cycle?')
}
if (ranked.RANKED_AMERICANO_GAMES !== schedule.COMPETITION_SCHEDULE.games) {
  throw new Error('RANKED_AMERICANO_GAMES not initialized')
}
if (!app.default) {
  throw new Error('App default export missing')
}

async function readProjectFile(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8')
}

function countMatches(source: string, pattern: string): number {
  return source.split(pattern).length - 1
}

const competitionFormSource = await readProjectFile('src/pages/CompetitionForm.tsx')
const friendlyFormSource = await readProjectFile('src/pages/FriendlyGameForm.tsx')

if (countMatches(competitionFormSource, '<SessionSetupControls') !== 1) {
  throw new Error('CompetitionForm must render exactly one shared SessionSetupControls block')
}

if (countMatches(friendlyFormSource, '<SessionSetupControls') !== 1) {
  throw new Error('FriendlyGameForm must render exactly one shared SessionSetupControls block')
}

for (const forbidden of ['GameBoardPreview', 'friendlyOrganizedGames', 'friendlyOrganizedSession']) {
  if (friendlyFormSource.includes(forbidden)) {
    throw new Error(`FriendlyGameForm must not reintroduce its own setup preview source: ${forbidden}`)
  }
}

console.log('check:cycles ok')
