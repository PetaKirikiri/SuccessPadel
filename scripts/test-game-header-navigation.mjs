import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('match header contains game navigation and countdown, not the weekly calendar', () => {
  const header = read('src/components/GameCard/GameCardHeader.tsx')
  assert.doesNotMatch(header, /CompetitionWeekCalendar|competition-week-strip/)
  assert.match(header, /tvNav\.onPrev/)
  assert.match(header, /tvNav\.onNext/)
  assert.match(header, /game-card-header-timer__value/)
})

test('all viewport header themes work independently of the removed calendar', () => {
  for (const size of ['mobile', 'tablet', 'web', 'tv']) {
    const css = read(`src/layouts/game-card/game-card.${size}.css`)
    assert.doesNotMatch(css, /competition-week-strip/)
    assert.ok(css.includes(`html[data-viewport='${size}'] .game-card-tv-header-panel:has(.game-card-tv-header-title-row)`))
  }
})
