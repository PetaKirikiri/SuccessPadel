import { useCallback, useEffect, useRef } from 'react'
import {
  loadFriendlyFormDraft,
  saveFriendlyFormDraft,
  clearFriendlyFormDraft,
  type FriendlyFormValues,
} from '../lib/friendlyFormDraft'

type Options = {
  values: FriendlyFormValues
  enabled?: boolean
}

export function useFriendlyFormDraft({ values, enabled = true }: Options) {
  const readyRef = useRef(false)
  const valuesRef = useRef(values)
  valuesRef.current = values

  useEffect(() => {
    if (!enabled) return
    readyRef.current = true
    const draft = loadFriendlyFormDraft()
    if (draft) saveFriendlyFormDraft(valuesRef.current)
  }, [enabled])

  const persistNow = useCallback(() => {
    if (!enabled) return
    saveFriendlyFormDraft(valuesRef.current)
  }, [enabled])

  useEffect(() => {
    if (!enabled || !readyRef.current) return
    const timer = window.setTimeout(() => {
      saveFriendlyFormDraft(valuesRef.current)
    }, 100)
    return () => {
      window.clearTimeout(timer)
      saveFriendlyFormDraft(valuesRef.current)
    }
  }, [enabled, values])

  useEffect(() => {
    if (!enabled) return
    const flush = () => persistNow()
    window.addEventListener('beforeunload', flush)
    window.addEventListener('pagehide', flush)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('beforeunload', flush)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
      flush()
    }
  }, [enabled, persistNow])

  const clearDraft = useCallback(() => {
    clearFriendlyFormDraft()
  }, [])

  return { persistNow, clearDraft }
}
