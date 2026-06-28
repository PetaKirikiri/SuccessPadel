/**
 * Fails if ts-prune reports unused exports in src/.
 * Run: npm run check:dead
 */
import { execSync } from 'node:child_process'

try {
  execSync('npx --yes ts-prune --project tsconfig.app.json', {
    stdio: 'inherit',
    cwd: new URL('..', import.meta.url).pathname,
  })
} catch {
  process.exit(1)
}
