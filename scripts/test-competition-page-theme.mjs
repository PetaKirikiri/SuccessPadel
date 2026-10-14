import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const bootstrap = html.match(/<script id="sp-competition-page-theme-bootstrap">([\s\S]*?)<\/script>/)[1]

function page(pathname) {
  const attributes = new Map()
  const events = new Map()
  const meta = new Map()
  const window = { location: { pathname }, addEventListener: (name, fn) => events.set(name, fn) }
  const document = {
    documentElement: {
      setAttribute: (name, value) => attributes.set(name, value),
      removeAttribute: (name) => attributes.delete(name),
    },
    querySelector: () => ({ setAttribute: (name, value) => meta.set(name, value) }),
  }
  vm.runInNewContext(bootstrap, { window, document })
  return { attributes, events, meta, window }
}

test('all competition entry routes set the background before React or data', () => {
  for (const path of ['/', '/competitive', '/competitive/', '/c/16fdd493', '/c/16fdd493/', '/competitions', '/competitions/uuid', '/competitions/new', '/competitions/uuid/edit']) {
    const result = page(path)
    assert.equal(result.attributes.get('data-page-theme'), 'competition', path)
    assert.equal(result.meta.get('content'), '#191823', path)
  }
  assert.ok(html.indexOf('id="sp-competition-page-theme-bootstrap"') < html.indexOf('</head>'))
  assert.ok(html.indexOf('id="sp-competition-page-theme-bootstrap"') < html.indexOf('src="/src/main.tsx"'))
})

test('non-competition routes retain their original theme', () => {
  for (const path of ['/friendly', '/rules', '/tactics', '/profile', '/login', '/competitive-other', '/c']) {
    assert.equal(page(path).attributes.has('data-page-theme'), false, path)
  }
})

test('client navigation and browser history restore the correct page theme', () => {
  const result = page('/c/16fdd493')
  result.window.location.pathname = '/friendly'
  result.events.get('sp:route-theme')()
  assert.equal(result.attributes.has('data-page-theme'), false)
  assert.equal(result.meta.get('content'), '#0b2a4a')
  result.window.location.pathname = '/competitive'
  result.events.get('popstate')()
  assert.equal(result.attributes.get('data-page-theme'), 'competition')
})

test('first paint and loaded shell share the card background without layout overrides', () => {
  const css = html.match(/<style id="sp-competition-page-theme">([\s\S]*?)<\/style>/)[1]
  for (const selector of ["html:root[data-page-theme='competition'] body", "html:root[data-page-theme='competition'] #root", "html:root[data-page-theme='competition'] .viewport-lock", "html:root[data-page-theme='competition'] .shell-paper.game-bg"]) {
    assert.ok(css.includes(selector), selector)
  }
  assert.ok(css.includes('background: #191823'))
  assert.doesNotMatch(css, /!important|height:|width:|padding:|margin:/)
})
