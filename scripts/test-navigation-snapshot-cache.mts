import assert from 'node:assert/strict'
import { createNavigationSnapshotCache } from '../src/lib/navigationSnapshotCache'

const cache = createNavigationSnapshotCache<{ score: number; photo?: string }>()
const key = 'viewer:competition'
await cache.refresh(key, async () => ({ score: 3 }))
const retained = cache.read(key)
const off = cache.subscribe(key, () => {})
off()
assert.equal(cache.read(key), retained, 'Back reads the exact retained snapshot synchronously')
let finish!: (value: { score: number }) => void
let calls = 0
const loader = () => { calls++; return new Promise<{ score: number }>(resolve => { finish = resolve }) }
const refresh = cache.refresh(key, loader)
const duplicate = cache.refresh(key, loader)
await Promise.resolve()
assert.equal(calls, 1, 'Concurrent refreshes share one request')
assert.equal(cache.read(key).data?.score, 3, 'Visible scores stay available during refresh')
finish({ score: 4 })
await Promise.all([refresh, duplicate])
assert.equal(cache.read(key).data?.score, 4)
await cache.refresh(key, async () => { throw new Error('Offline') })
assert.equal(cache.read(key).data?.score, 4, 'Network failure keeps the previous game visible')
assert.equal(cache.read(key).error, 'Offline')
assert.equal(cache.read('other-viewer:competition').data, null, 'Viewer changes do not reuse another viewer snapshot')
assert.equal(cache.read('viewer:other-competition').data, null, 'Different games do not share data')
const slow = cache.refresh(key, loader)
await Promise.resolve()
cache.update(key, value => ({ ...value!, score: 5 }))
finish({ score: 2 })
await slow
assert.equal(cache.read(key).data?.score, 5, 'An older response cannot roll back a local score')
const beforePhoto = cache.read(key).data
const newer = cache.refresh(key, loader)
await Promise.resolve()
cache.update(key, value => value === beforePhoto ? { ...value!, photo: 'avatar' } : value, false)
finish({ score: 6 })
await newer
assert.equal(cache.read(key).data?.score, 6, 'Photo enrichment must not suppress a newer server response')
cache.update(key, value => value === beforePhoto ? { score: 1 } : value, false)
assert.equal(cache.read(key).data?.score, 6, 'Late photo response cannot replace new score data')
let notifications = 0
const unsubscribe = cache.subscribe(key, () => notifications++)
await cache.refresh(key, async () => ({ score: 7 }))
assert.equal(notifications, 1)
unsubscribe()
const bounded = createNavigationSnapshotCache<number>(2)
await bounded.refresh('a', async () => 1)
const keep = bounded.subscribe('a', () => {})
await bounded.refresh('b', async () => 2)
await bounded.refresh('c', async () => 3)
assert.equal(bounded.read('a').data, 1, 'Mounted screen is never evicted')
keep()
console.log('Navigation snapshot checks passed: instant return, refresh, failures, isolation, score races and eviction')
