import { useCallback, useEffect, useRef } from 'react'
import {
  loadFriendlyFormDraft,
  saveFriendlyFormDraft,
  clearFriendlyFormDraft,
  type FriendlyFormValues,
} from '../lib/friendlyFormDraft'

type Options = {
  values: FriendlyFormValues
}

export function useFriendlyFormDraft({ values }: Options) {
  const readyRef = useRef(false)
  const valuesRef = useRef(values)
  valuesRef.current = values

  useEffect(() => {
    readyRef.current = true
    const draft = loadFriendlyFormDraft()
    if (draft) saveFriendlyFormDraft(valuesRef.current)
  }, [])

  const persistNow = useCallback(() => {
    saveFriendlyFormDraft(valuesRef.current)
  }, [])

  useEffect(() => {
    if (!readyRef.current) return
    const timer = window.setTimeout(() => {
      saveFriendlyFormDraft(valuesRef.current)
    }, 100)
    return () => {
      window.clearTimeout(timer)
      saveFriendlyFormDraft(valuesRef.current)
    }
  }, [values])

  useEffect(() => {
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
  }, [persistNow])

  const clearDraft = useCallback(() => {
    clearFriendlyFormDraft()
  }, [])

  return { persistNow, clearDraft }
}
