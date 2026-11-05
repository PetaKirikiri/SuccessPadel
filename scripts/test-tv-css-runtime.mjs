import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { optimizeTvCssRuntime } from './tvCssRuntime.mjs'
const source = await readFile(import.meta.resolve('css-has-pseudo/browser').replace('file://',''), 'utf8')
const result = optimizeTvCssRuntime(source)
assert.equal(result.split('documentElement.style.zoom=1').length - 1, 2, 'Keep legacy redraw for added and removed matches')
assert.ok(result.includes('!t.hasAttribute(r.attributeName)&&(t.setAttributeNode'))
assert.ok(result.includes('t.removeAttribute(r.attributeName)'))
assert.throws(()=>optimizeTvCssRuntime('changed dependency'), /runtime changed/)
console.log('TV runtime: redraw retained for changed matches, no repeated attribute writes, stale matches still removed, dependency drift detected.')

// Execute the transformed match callback: first match redraws; timer ticks do not.
const callback = result.split('[].forEach.call(s,function(t){')[1].split('}),r.nodes.forEach')[0]
const applyMatch = new Function('t', 'o', 'n', 'r', 'e', callback)
let writes = 0
let redraws = 0
let present = false
const element = {
  hasAttribute: () => present,
  setAttributeNode: () => { present = true; writes++ },
}
const document = { documentElement: { style: { set zoom(value) { redraws++ } } } }
const scratch = { children: [{ attributes: [{ cloneNode: () => ({}) }] }] }
applyMatch(element, [], scratch, { attributeName: 'test' }, document)
assert.equal(writes, 1)
assert.equal(redraws, 2)
applyMatch(element, [], scratch, { attributeName: 'test' }, document)
assert.equal(writes, 1, 'Unchanged match must not rewrite its attribute')
assert.equal(redraws, 2, 'Unchanged match must not trigger another redraw')
