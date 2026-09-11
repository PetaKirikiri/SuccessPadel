import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkViewportFile, parseLayoutRules, scopeViolations } from './layout-isolation.mjs'

const file = 'src/layouts/invite/invite.mobile.css'
test('accept scoped rules, quoted attributes and nested selector lists', () => {
  assert.deepEqual(checkViewportFile(`@media (min-width: 1px) { html[data-viewport="mobile"] :is(.one, .two) { padding: 4px; } }`, file), [])
})
for (const [name, css] of Object.entries({
  wrongMode: "html[data-viewport='tv'] .card { height: 500px; }",
  nestedWrongMode: "@media (min-width: 1px) { html[data-viewport='tv'] .card { height: 500px; } }",
  unscopedPregame: '.competition-pregame__player { height: 500px; }',
  selectorListLeak: "html[data-viewport='mobile'] .card, .other { height: 500px; }",
  disguisedScope: ".other:has(html[data-viewport='mobile']) { height: 500px; }",
  globalImport: "@import './invite.tv.css';",
  globalAnimation: '@keyframes grow { from { opacity: 0; } to { opacity: 1; } }',
  siblingEscape: "html[data-viewport='mobile'] + body { height: 500px; }",
})) test(`reject ${name}`, () => assert.ok(checkViewportFile(css, file).length))

test('nested rules preserve original line numbers', () => {
  assert.equal(parseLayoutRules('/* comment */\n@media (min-width: 1px) {\n .bad { color: red; }\n}', file)[0].line, 3)
})
test('mobile scope accepts only isolated mobile files', () => {
  assert.deepEqual(scopeViolations([file], 'mobile'), [])
  assert.equal(scopeViolations(['src/layouts/invite/invite.tv.css', 'src/components/GameCard/GameCard.tsx', 'src/index.css'], 'mobile').length, 3)
})
test('shared changes cannot weaken the checks themselves', () => {
  assert.equal(scopeViolations(['scripts/layout-isolation.mjs', 'package.json', '.github/workflows/layout-integrity.yml'], 'shared').length, 3)
})
test('scope required; no silent shared fallback', () => {
  assert.throws(() => scopeViolations([file], undefined))
})

test('CLI checks unstaged, untracked and renamed files without touching the project', () => {
  const fixture = mkdtempSync(path.join(tmpdir(), 'padel-layout-scope-test-'))
  const script = fileURLToPath(new URL('./check-layout-scope.mjs', import.meta.url))
  const git = (...args) => execFileSync('git', args, { cwd: fixture, stdio: 'pipe' })
  const check = (...args) => spawnSync(process.execPath, [script, '--scope', 'mobile', ...args], { cwd: fixture, encoding: 'utf8' })
  try {
    git('init', '-q')
    mkdirSync(path.join(fixture, 'src/layouts/invite'), { recursive: true })
    const mobile = path.join(fixture, file)
    writeFileSync(mobile, "html[data-viewport='mobile'] .card { width: 100%; }")
    git('add', '.')
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture')
    writeFileSync(mobile, "html[data-viewport='mobile'] .card { width: 90%; }")
    assert.equal(check().status, 0)
    const shared = path.join(fixture, 'src/index.css')
    writeFileSync(shared, '.card { width: 80%; }')
    assert.equal(check().status, 1, 'untracked shared stylesheet must block mobile scope')
    rmSync(shared)
    renameSync(mobile, path.join(fixture, 'src/layouts/invite/invite.tv.css'))
    git('add', '-A')
    assert.equal(check('--staged').status, 1, 'rename into another mode must fail')
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
})
