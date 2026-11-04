import type { PointerEvent, KeyboardEvent } from 'react'

export type AttendanceStatus = 'pending' | 'confirmed' | 'cancelled'
export type AttendancePlayer = Readonly<{
  id: string
  name: string
  avatar: string | null
  profileId?: string | null
  padelPlayerId?: string | null
  status: AttendanceStatus
}>
export type AttendanceControls = Readonly<{
  sessionId: string
  busyPlayerId: string | null
  disabled: boolean
  onAttendance: (id: string, status: AttendanceStatus) => void
}>
export type RosterDrag = Readonly<{
  enabled: boolean
  saving: boolean
  targetId: string | null
  draggingId: string | null
  pointerDown: (event: PointerEvent<HTMLElement>, index: number) => void
  pointerMove: (event: PointerEvent<HTMLElement>) => void
  pointerUp: (event: PointerEvent<HTMLElement>) => void
  cancel: () => void
  keyDown: (event: KeyboardEvent<HTMLElement>, index: number) => void
}>
export type SinglesRosterProps = AttendanceControls & {
  format: 'singles'
  players: readonly AttendancePlayer[]
  drag: RosterDrag
}
export type DuosRosterProps = AttendanceControls & {
  format: 'duos'
  teams: readonly (readonly [AttendancePlayer, AttendancePlayer])[]
}
export type CompetitionRosterProps = SinglesRosterProps | DuosRosterProps
