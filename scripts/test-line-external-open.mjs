import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function harness() {
  const timers = new Map()
  const listeners = new Map()
  let opens = 0
  let nextId = 0
  let succeed = true
  const source = readFileSync('src/lib/line/forceExternalBrowser.ts', 'utf8')
    .replace(/^import .*$/gm, '')
  const context = {
    exports: {}, URL, navigator: { userAgent: 'iPhone' },
    hasLiffId: () => true, initLiff: async () => {},
    isInLineClient: () => true, isLineLiffBrowser: () => true,
    liff: { isApiAvailable: () => true, openWindow: () => { opens++; if (!succeed) throw new Error('blocked') } },
    window: {
      setTimeout: (fn) => { timers.set(++nextId, fn); return nextId },
      clearTimeout: id => timers.delete(id),
      location: { assign: () => { throw new Error('blocked') } },
    },
    document: {
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: name => listeners.delete(name),
      getElementById: () => null,
    },
  }
  vm.runInNewContext(ts.transpile(source, { module: ts.ModuleKind.CommonJS }), context)
  return {
    start: () => context.exports.scheduleForceExternalOpen('https://successpadel.app/auth/line/complete'),
    tick: async () => {
      const pending = [...timers.values()]; timers.clear()
      pending.forEach(fn => fn())
      await new Promise(resolve => setImmediate(resolve))
    },
    gesture: () => { for (const fn of listeners.values()) fn() },
    block: () => { succeed = false }, allow: () => { succeed = true },
    opens: () => opens, listeners: () => listeners.size,
  }
}

test('timers and simultaneous gestures open a one-use link only once', async () => {
  const h = harness(); h.start(); h.gesture(); await h.tick()
  h.gesture(); await h.tick()
  assert.equal(h.opens(), 1)
  assert.equal(h.listeners(), 0)
})

test('a blocked opening can retry on a real gesture and then stops', async () => {
  const h = harness(); h.block(); h.start(); await h.tick()
  assert.equal(h.opens(), 1)
  h.allow(); h.gesture(); await h.tick(); h.gesture(); await h.tick()
  assert.equal(h.opens(), 2)
  assert.equal(h.listeners(), 0)
})

test('unmount cancels pending openings', async () => {
  const h = harness(); h.start()(); await h.tick(); h.gesture()
  assert.equal(h.opens(), 0)
})
