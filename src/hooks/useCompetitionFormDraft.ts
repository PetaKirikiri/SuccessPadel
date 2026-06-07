import { useEffect, useRef, useState } from 'react'
import {
  clearCompetitionFormDraft,
  loadCompetitionFormDraft,
  saveCompetitionFormDraft,
  type CompetitionFormDraft,
} from '../lib/competitionFormDraft'

type Options = {
  scope: 'new' | string
  restore: boolean
  persist: boolean
  values: Omit<CompetitionFormDraft, 'v' | 'savedAt'>
  onRestore: (draft: CompetitionFormDraft) => void
}

export function useCompetitionFormDraft({ scope, restore, persist, values, onRestore }: Options) {
  const [restored, setRestored] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const readyRef = useRef(false)
  const onRestoreRef = useRef(onRestore)
  onRestoreRef.current = onRestore

  useEffect(() => {
    if (!restore) {
      readyRef.current = true
      return
    }
    const draft = loadCompetitionFormDraft(scope)
    if (draft) {
      onRestoreRef.current(draft)
      setRestored(true)
      setSavedAt(draft.savedAt)
    }
    readyRef.current = true
  }, [scope, restore])

  useEffect(() => {
    if (!persist || !readyRef.current) return
    const timer = window.setTimeout(() => {
      saveCompetitionFormDraft(scope, values)
      setSavedAt(new Date().toISOString())
    }, 600)
    return () => window.clearTimeout(timer)
  }, [scope, persist, values])

  const clearDraft = () => {
    clearCompetitionFormDraft(scope)
    setSavedAt(null)
    setRestored(false)
  }

  return { restored, savedAt, clearDraft, dismissRestored: () => setRestored(false) }
}
