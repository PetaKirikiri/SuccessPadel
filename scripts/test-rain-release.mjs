import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
const config = JSON.parse(readFileSync('vercel.json', 'utf8'))
for (const source of ['/rain-mode', '/rain-mode/']) {
  assert.equal(config.rewrites.find(rule => rule.source === source)?.destination, '/index.html')
}
assert(!existsSync('public/rain-mode/index.html'), 'A static index must not shadow score-enabled Rain Mode')
assert(existsSync('public/rain-mode-readonly/index.html'), 'Keep the read-only staff fallback')
const routes = readFileSync('src/foundation/routes.tsx', 'utf8')
assert(routes.includes('path="/rain-mode"'))
assert(routes.includes('../surfaces/rain-test/RainModePreview'))
console.log('Rain release: live route serves the score-enabled app; read-only fallback preserved.')
