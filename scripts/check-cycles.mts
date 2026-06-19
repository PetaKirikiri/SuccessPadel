/**
 * Catches module init cycles (white screen) before they ship.
 * Run: npm run check:cycles
 */
import { createServer } from 'vite'
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
const app = await load('src/App.tsx')

if (presets.SINGLES_COMPETITION?.gameCount !== 7) {
  throw new Error('SINGLES_COMPETITION.gameCount not initialized — formatPresets/rankedSchedule cycle?')
}
if (ranked.RANKED_AMERICANO_GAMES !== 7) {
  throw new Error('RANKED_AMERICANO_GAMES not initialized')
}
if (!app.default) {
  throw new Error('App default export missing')
}

console.log('check:cycles ok')
