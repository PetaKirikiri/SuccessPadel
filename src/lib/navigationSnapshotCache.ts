type Snapshot<T> = { data: T | null; error: string | null }
type Entry<T> = {
  snapshot: Snapshot<T>
  listeners: Set<() => void>
  inflight: Promise<void> | null
  revision: number
}

/** In-memory route snapshots. Keys must include the viewer and resource identity. */
export function createNavigationSnapshotCache<T>(limit = 6) {
  const entries = new Map<string, Entry<T>>()
  function entry(key: string): Entry<T> {
    const existing = entries.get(key)
    if (existing) return existing
    for (const [oldKey, old] of entries) {
      if (entries.size < limit) break
      if (!old.inflight && old.listeners.size === 0) entries.delete(oldKey)
    }
    const next: Entry<T> = { snapshot: { data: null, error: null }, listeners: new Set(), inflight: null, revision: 0 }
    entries.set(key, next)
    return next
  }
  function publish(target: Entry<T>, snapshot: Snapshot<T>) {
    target.snapshot = snapshot
    target.listeners.forEach(listener => listener())
  }
  return {
    read(key: string) { return entry(key).snapshot },
    subscribe(key: string, listener: () => void) {
      const target = entry(key)
      target.listeners.add(listener)
      return () => { target.listeners.delete(listener) }
    },
    update(key: string, update: (current: T | null) => T | null, protectPending = true) {
      const target = entry(key)
      const data = update(target.snapshot.data)
      if (data !== target.snapshot.data) {
        if (protectPending) target.revision += 1
        publish(target, { data, error: target.snapshot.error })
      }
    },
    refresh(key: string, loader: () => Promise<T>): Promise<void> {
      const target = entry(key)
      if (target.inflight) return target.inflight
      const revision = target.revision
      const run = Promise.resolve().then(loader).then(data => {
        // A local score or newer snapshot must survive an older network response.
        if (target.revision === revision) publish(target, { data, error: null })
      }).catch(error => {
        if (target.revision === revision) publish(target, {
          data: target.snapshot.data,
          error: error instanceof Error ? error.message : 'Failed to load competition',
        })
      }).finally(() => { if (target.inflight === run) target.inflight = null })
      target.inflight = run
      return run
    },
  }
}
