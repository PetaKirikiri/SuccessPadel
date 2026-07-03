type HubCacheEntry<T> = {
  data: T
  loadedAt: number
}

type HubCacheState<T> = {
  entry: HubCacheEntry<T> | null
  inflight: Promise<T> | null
}

export function createHubListCache<T>() {
  const state: HubCacheState<T> = { entry: null, inflight: null }

  return {
    read(): HubCacheEntry<T> | null {
      return state.entry
    },
    clear() {
      state.entry = null
    },
    async load(loader: () => Promise<T>, opts?: { force?: boolean }): Promise<T> {
      if (!opts?.force && state.inflight) return state.inflight

      if (!opts?.force && state.entry) return state.entry.data

      const run = (async () => {
        const data = await loader()
        state.entry = { data, loadedAt: Date.now() }
        return data
      })()

      state.inflight = run
      try {
        return await run
      } finally {
        if (state.inflight === run) state.inflight = null
      }
    },
  }
}
