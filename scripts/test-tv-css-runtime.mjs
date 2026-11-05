import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { optimizeTvCssRuntime } from './tvCssRuntime.mjs'
const source = await readFile(import.meta.resolve('css-has-pseudo/browser').replace('file://',''), 'utf8')
const result = optimizeTvCssRuntime(source)
assert.ok(!result.includes('documentElement.style.zoom'))
assert.ok(result.includes('!t.hasAttribute(r.attributeName)&&t.setAttributeNode'))
assert.ok(result.includes('t.removeAttribute(r.attributeName)'))
assert.throws(()=>optimizeTvCssRuntime('changed dependency'), /runtime changed/)
console.log('TV runtime: no zoom reflow, no repeated attribute writes, stale matches still removed, dependency drift detected.')
