import { test } from 'node:test'
import assert from 'node:assert/strict'
import { duoStandings } from '../src/lib/competition-formats/duos/standings.ts'
import { singlesStandings } from '../src/lib/competition-formats/singles/standings.ts'
import { fixedPairRoster } from '../src/lib/competition-formats/duos/roster.ts'
import { checkFormatCss, checkFormatModule, formatScope, rosterHook } from './check-competition-formats.mjs'
import { fileScope, checkViewportFile } from './layout-isolation.mjs'
import fs from 'node:fs'

const solo = { profile_id: 'person-a', display_name: 'A', total_points: 6, games: 1 }
const pair = n => ({ ...solo, profile_id: `duo:a${n}:b${n}`, player_a_id: `a${n}`, player_b_id: `b${n}`, player_a_name: 'A', player_b_name: 'B' })
test('duos remain eight team rows before and after first saved score and refresh', () => {
  for (const score of [0, 6, 12]) {
    const entries = Array.from({ length: 8 }, (_, n) => ({ ...pair(n), total_points: score }))
    const result = duoStandings(JSON.parse(JSON.stringify(entries)), 8)
    assert.equal(result.error, null)
    assert.equal(result.entries.length, 8)
    assert.equal(result.entries[0].total_points, score) // not twice the team score
  }
})
test('duos reject individual, mixed, missing, and duplicate rows', () => {
  for (const entries of [[solo, solo], [pair(0), solo], [pair(0)], [pair(0), pair(0)]]) {
    const result = duoStandings(entries, 2)
    assert.equal(result.format, 'duos')
    assert.ok(result.error)
    assert.deepEqual(result.entries, [])
  }
})
test('a team requires two different identified players', () => {
  assert.ok(duoStandings([pair(0), { ...pair(1), player_b_id: 'a1' }], 2).error)
  assert.ok(duoStandings([pair(0), { ...pair(1), player_b_name: '' }], 2).error)
})
test('singles reject team records but retain individual scores', () => {
  assert.ok(singlesStandings([pair(0)]).error)
  assert.equal(singlesStandings([solo]).entries[0].total_points, 6)
})
test('fixed-pair membership is independent of names and input array order', () => {
  const players = ['b', 'a', 'd', 'c'].map(id => ({ id, name: 'Same name' }))
  const pairs = [{ roster_a_id: 'a', roster_b_id: 'b' }, { roster_a_id: 'c', roster_b_id: 'd' }]
  assert.deepEqual(fixedPairRoster(players, pairs).players.map(p => p.id), ['a', 'b', 'c', 'd'])
  assert.deepEqual(fixedPairRoster(players, pairs).teams.map(team => team.map(p => p.id)), [['a', 'b'], ['c', 'd']])
  assert.deepEqual(fixedPairRoster([...players].reverse(), pairs).players.map(p => p.id), ['a', 'b', 'c', 'd'])
  assert.ok(fixedPairRoster(players, []).error)
  assert.ok(fixedPairRoster(players, [pairs[0], pairs[0]]).error)
})
test('format presenters reject cross-format, database, computed and re-export imports', () => {
  const file = 'src/components/competition-formats/duos/DuosRoster.tsx'
  assert.deepEqual(checkFormatModule("import type { DuosRosterProps } from '../rosterContract'; import { PlayerNameLink } from '../../../shared/ProfilePhoto/PlayerNameLink'", file), [])
  for (const source of [
    "import { SinglesRoster } from '../singles/SinglesRoster'",
    "export { SinglesRoster } from '../singles/SinglesRoster'",
    "const other = import('../singles/SinglesRoster')",
    "const other = require('../singles/SinglesRoster')",
    "const other = import(path)",
    "import { supabase } from '../../../lib/supabaseClient'",
    "export const View = () => <div style={{display:'grid'}} />",
  ]) assert.ok(checkFormatModule(source, file).length, source)
})
test('a duo-mobile file belongs to BOTH the duo and mobile boundaries', () => {
  const file = 'src/layouts/competition-formats/duos/roster.mobile.css'
  assert.equal(fileScope(file), 'mobile')
  assert.equal(formatScope(file), 'duos')
  const own = "html[data-viewport='mobile'] .competition-pregame[data-competition-format='duos'] .competition-pregame__player { display:grid }"
  assert.deepEqual(checkFormatCss(own, 'duos'), [])
  assert.deepEqual(checkViewportFile(own, file), [])
  assert.ok(checkViewportFile(own.replace("'mobile'", "'tv'"), file).length)
  assert.ok(checkFormatCss(own.replace("'duos'", "'singles'"), 'duos').length)
  assert.equal(fileScope('scripts/check-competition-formats.mjs'), 'infrastructure')
})
test('roster markup is format-owned and shared controller has no player cards', () => {
  const parent = fs.readFileSync('src/components/InviteCard/CompetitionPregamePanel.tsx', 'utf8')
  assert.ok(!parent.includes('<li className={`competition-pregame__player'))
  assert.ok(parent.includes('<CompetitionRoster format="duos"'))
  assert.ok(parent.includes('<CompetitionRoster format="singles"'))
  assert.ok(!rosterHook.test('.competition-pregame__players'))
  const duo = fs.readFileSync('src/components/competition-formats/duos/DuosRoster.tsx', 'utf8')
  assert.ok(duo.includes('teams.flatMap'))
  assert.ok(!duo.includes('onPointerDown'))
  const singles = fs.readFileSync('src/components/competition-formats/singles/SinglesRoster.tsx', 'utf8')
  assert.ok(singles.includes('onPointerDown'))
})
test('format CSS cannot escape into singles or the unscoped shell', () => {
  assert.deepEqual(checkFormatCss("html[data-viewport='tv'] [data-competition-format='duos'] .row {display:grid}", 'duos'), [])
  for (const css of [".row {display:grid}", "[data-competition-format='singles'] .row {display:grid}", ":not([data-competition-format='duos']) .row {display:grid}", "[data-competition-format='duos'] + .other {display:grid}", "@import 'shared.css';"]) assert.ok(checkFormatCss(css, 'duos').length)
  assert.equal(formatScope('src/components/GameCard/GameCard.tsx'), 'shared')
  assert.equal(formatScope('src/lib/competition-formats/duos/standings.ts'), 'duos')
})
test('both play leaderboard surfaces pass the explicit format contract', () => {
  const source = fs.readFileSync('src/foundation/play/GameCardPlayEvent.tsx', 'utf8')
  assert.equal((source.match(/competitionFormat=\{standingsModel.format\}/g) ?? []).length, 2)
  assert.ok(source.includes('return duoStandings(effectiveDuoStandings, teams.length)'))
  assert.ok(source.includes('computeDuoStandings(roster, rounds, courtMatches, teams)'))
  const renderer = fs.readFileSync('src/components/leaderboard/Leaderboard.tsx', 'utf8')
  assert.ok(renderer.includes("simpleTeamRow={compact && (competitionFormat === 'duos'"), 'Sidebar team presentation must not replace the standard mobile team row')
})
