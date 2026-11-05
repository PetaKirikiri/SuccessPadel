import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import postcss from 'postcss'
import has from 'css-has-pseudo'
const source = await readFile('src/layouts/invite/invite.tv.css', 'utf8')
const result = await postcss([has({ preserve: true })]).process(source, { from: undefined })
assert.match(result.css, /csstools-has-/)
assert.match(result.css, /:has\(/)
const files = await readdir('dist/assets')
const css = (await Promise.all(files.filter(f => f.endsWith('.css')).map(f => readFile(`dist/assets/${f}`, 'utf8')))).join('\n')
assert.match(css, /csstools-has-/,'Production CSS must contain fallback selectors')
assert.match(css, /:has\(/,'Native selectors must be preserved')
assert.doesNotMatch(css, /@layer\b/, 'Older TV engines must not receive CSS layers')
console.log('TV compatibility passed: transformed invite selectors, native rules preserved, built fallbacks present, layers flattened.')
