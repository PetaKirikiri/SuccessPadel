import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'

// Run against Vite with agent-browser installed. This fixture only changes local
// React state: it has no competition IDs, persistence callback or data fetch.
const browser = process.env.AGENT_BROWSER_BIN || 'agent-browser'
const base = process.env.FORMAT_PREVIEW_URL || 'http://127.0.0.1:5173'
const run = (...args) => execFileSync(browser, ['--session', 'format-roster-regression', ...args], { encoding: 'utf8', timeout: 30000 })
const evaluate = expression => JSON.parse(JSON.parse(run('eval', `JSON.stringify(${expression})`)))
try {
  for (const format of ['singles', 'duos']) {
    for (const [mode, width, height] of [['mobile',390,844], ['tablet',834,1112], ['web',1280,900], ['tv',1920,1080]]) {
      run('set', 'viewport', String(width), String(height))
      run('open', `${base}/tests/competition-formats/index.html?format=${format}`)
      run('wait', '.competition-pregame__roster')
      const read = () => evaluate(`({
        format:document.querySelector('.competition-pregame').dataset.competitionFormat,
        viewport:document.documentElement.dataset.viewport,
        players:document.querySelectorAll('.competition-pregame__player').length,
        teams:new Set([...document.querySelectorAll('[data-team-number]')].map(e=>e.dataset.teamNumber)).size,
        drag:document.querySelectorAll('[data-reorder-enabled="true"]').length,
        yes:document.querySelector('.competition-pregame__attendance-yes').getAttribute('aria-pressed'),
        no:document.querySelector('.competition-pregame__attendance-no').getAttribute('aria-pressed'),
        overflow:document.documentElement.scrollWidth > innerWidth
      })`)
      const initial = read()
      assert.equal(initial.format, format)
      assert.equal(initial.viewport, mode)
      assert.equal(initial.players, 16)
      assert.equal(initial.teams, format === 'duos' ? 8 : 0)
      assert.equal(initial.drag, 0, 'Anonymous fixture must not expose dragging')
      assert.equal(initial.overflow, false)
      for (const [label, yes, no] of [
        ['Malaka: confirm attendance','true','false'],
        ['Malaka: confirm attendance','false','false'],
        ['Malaka: can’t play','false','true'],
        ['Malaka: can’t play','false','false'],
      ]) {
        run('find', 'role', 'button', 'click', '--name', label, '--exact')
        const state = read()
        assert.equal(state.yes, yes)
        assert.equal(state.no, no)
        assert.equal(state.players, initial.players)
        assert.equal(state.teams, initial.teams)
      }
      console.log(`PASS ${format}/${mode}: roster identity, width, attendance toggles`)
    }
  }
} finally { run('close') }
