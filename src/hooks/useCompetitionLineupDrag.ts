import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react'
import type { CompetitionPlayer } from './useCompetitions'
import { clearCompetitionHubCache } from './useCompetitionHubRows'
import { lineupSnapshot, moveLineupPlayer, nearestLineupSlot, occupantsInFixedSlots } from '../lib/competitionLineupOrder'
import { supabase } from '../lib/supabaseClient'

export function useCompetitionLineupDrag(sessionId: string, source: CompetitionPlayer[], enabled: boolean) {
  const [players, setPlayers] = useState(source)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [targetId, setTargetId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const inFlight = useRef(false)
  const pending = useRef<{ snapshot: CompetitionPlayer[]; ordered: CompetitionPlayer[] }[]>([])
  const latestPlayers = useRef(source)
  const permitted = useRef(enabled)
  permitted.current = enabled
  const staleSource = useRef<string | null>(null)
  const drag = useRef<{
    from: number; to: number; snapshot: CompetitionPlayer[]; element: HTMLElement;
    x: number; y: number; left: number; top: number; animation: Animation | null
  } | null>(null)
  useEffect(() => () => { drag.current?.animation?.cancel(); drag.current = null }, [])
  useEffect(() => {
    if (!inFlight.current && !drag.current && JSON.stringify(lineupSnapshot(source)) !== staleSource.current) {
      latestPlayers.current = source
      setPlayers(source)
    }
  }, [source, sessionId])

  const saveMove = async (snapshot: CompetitionPlayer[], from: number, to: number) => {
    if (!enabled || from === to) return
    const ordered = moveLineupPlayer(snapshot, from, to)
    setMessage('')
    // Update once on drop; acknowledging the save must not reload the hub or
    // replace the cards again, which would interrupt scrolling and dragging.
    latestPlayers.current = occupantsInFixedSlots(snapshot, ordered)
    setPlayers(latestPlayers.current)
    pending.current.push({ snapshot, ordered })
    if (inFlight.current) return
    inFlight.current = true
    setSaving(true)
    let active = pending.current[0]!
    try {
      // Each move uses the previous move's acknowledged slot occupants. Never
      // race writes or refresh the visible list between acknowledgements.
      while (pending.current.length) {
        active = pending.current[0]!
        if (!permitted.current) throw new Error('Administrator access is required.')
        const { error } = await supabase.rpc('reorder_competition_slot_occupants', {
          p_session_id: sessionId,
          p_expected_slots: lineupSnapshot(active.snapshot),
          p_occupant_order: active.ordered.map((player) => player.id),
        })
        if (error) throw new Error(error.message)
        pending.current.shift()
        staleSource.current = JSON.stringify(lineupSnapshot(source))
        clearCompetitionHubCache()
      }
    } catch (error) {
      pending.current = []
      cancel()
      latestPlayers.current = active.snapshot
      setPlayers(active.snapshot)
      setMessage(`Order was not saved: ${error instanceof Error ? error.message : 'Please try again.'}`)
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  const pointerDown = (event: PointerEvent<HTMLElement>, index: number) => {
    if (!enabled || drag.current || !event.isPrimary || event.button !== 0) return
    if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const rect = event.currentTarget.getBoundingClientRect()
    drag.current = { from: index, to: index, snapshot: latestPlayers.current, element: event.currentTarget,
      x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, animation: null }
    setDraggingId(players[index]!.id)
    setTargetId(players[index]!.id)
  }
  const pointerMove = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current
    if (!current) return
    if (!enabled) { cancel(); return }
    current.animation?.cancel()
    const rect = current.element.getBoundingClientRect()
    const transform = `translate(${event.clientX - current.x + current.left - rect.left}px, ${event.clientY - current.y + current.top - rect.top}px)`
    // Measure the fixed footprints before floating this card again. Hit-testing
    // rendered elements misses grid gaps and can be blocked by the drag preview.
    const cards = Array.from(current.element.parentElement?.querySelectorAll<HTMLElement>('[data-lineup-player]') ?? [])
      .filter((element) => element.dataset.lineupSession === sessionId)
    const to = nearestLineupSlot(cards.map((element) => element.getBoundingClientRect()), event.clientX, event.clientY)
    if (to >= 0) { current.to = to; setTargetId(current.snapshot[to]!.id) }
    current.animation = current.element.animate([{ transform }, { transform }], { duration: 1, fill: 'forwards' })
    // Scroll the actual page container, not the fixed viewport wrapper.
    let parent = event.currentTarget.parentElement
    while (parent) {
      if (parent.scrollHeight > parent.clientHeight && /auto|scroll/.test(getComputedStyle(parent).overflowY)) {
        const bounds = parent.getBoundingClientRect()
        if (event.clientY > bounds.bottom - 55) parent.scrollBy(0, 20)
        else if (event.clientY < bounds.top + 55) parent.scrollBy(0, -20)
        break
      }
      parent = parent.parentElement
    }
  }
  const cancel = () => {
    drag.current?.animation?.cancel()
    drag.current = null
    setTargetId(null)
    setDraggingId(null)
  }
  const pointerUp = (event: PointerEvent<HTMLElement>) => {
    // A fast release can arrive beyond the last pointermove event.
    if (drag.current) pointerMove(event)
    const current = drag.current
    cancel()
    if (current) void saveMove(current.snapshot, current.from, current.to)
  }
  const keyDown = (event: KeyboardEvent<HTMLElement>, index: number) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Escape') { cancel(); return }
    const delta = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1
      : event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : 0
    if (!delta) return
    event.preventDefault()
    void saveMove(latestPlayers.current, index, Math.max(0, Math.min(latestPlayers.current.length - 1, index + delta)))
  }
  return { players, saving, message, targetId, draggingId, pointerDown, pointerMove, pointerUp, cancel, keyDown }
}
