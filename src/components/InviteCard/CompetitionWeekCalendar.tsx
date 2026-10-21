import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, Link2, Shuffle, X } from 'lucide-react'
import { competitionLevelLabel } from '../../lib/competitionLevel'
import { isDuoCompetition } from '../../lib/competitionFormatPresets'
import { useViewportBucket } from '../../contexts/ViewportContext'
import { useCompetitionHubRows } from '../../hooks/useCompetitionHubRows'
import { clubTodayDateInput, formatClubTime } from '../../lib/courtSchedule'
import { clubCompetitionDay, competitionWeekDays, shiftCalendarDay } from '../../lib/competitionCalendar'
import { competitionInvitePath } from '../../lib/competitionInviteLink'

function CalendarDialog({ competitionId, onClose }: { competitionId: string; onClose: () => void }) {
  const { rows, loading, error } = useCompetitionHubRows()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [anchor, setAnchor] = useState<string | null>(null)
  const current = rows.find(row => row.id === competitionId)
  const today = clubTodayDateInput()
  const days = competitionWeekDays(anchor ?? clubCompetitionDay(current?.starts_at ?? null) ?? today)
  const events = rows.filter(row => {
    const day = clubCompetitionDay(row.starts_at)
    return day !== null && day >= days[0] && day <= days[6] && row.status !== 'cancelled'
  }).sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? ''))
  const dayLabel = (day: string, options: Intl.DateTimeFormatOptions) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' })

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  return createPortal(
    <dialog ref={dialog} className="competition-week-dialog" aria-labelledby={titleId} onClose={onClose}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
      <div className="competition-week-dialog__body">
        <header className="competition-week-dialog__header">
          <h2 id={titleId}>Competitions</h2>
          <button type="button" aria-label="Close calendar" onClick={() => dialog.current?.close()}><X aria-hidden="true" /></button>
        </header>
        <nav className="competition-week-dialog__navigation" aria-label="Competition weeks">
          <button type="button" aria-label="Previous week" onClick={() => setAnchor(shiftCalendarDay(days[0], -7))}><ChevronLeft aria-hidden="true" /></button>
          <strong aria-live="polite">{dayLabel(days[0], { day: 'numeric', month: 'short' })} – {dayLabel(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
          <button type="button" aria-label="Next week" onClick={() => setAnchor(shiftCalendarDay(days[0], 7))}><ChevronRight aria-hidden="true" /></button>
        </nav>
        <div className="competition-week-dialog__days" aria-label="Days this week">
          {days.map(day => <div key={day} data-today={day === today} data-event={events.some(row => clubCompetitionDay(row.starts_at) === day)}>
            <span>{dayLabel(day, { weekday: 'narrow' })}</span><strong>{Number(day.slice(-2))}</strong><i aria-hidden="true" />
          </div>)}
        </div>
        <button type="button" className="competition-week-dialog__today" onClick={() => setAnchor(today)}>This week</button>
        {loading ? <p role="status">Loading competitions…</p> : error ? <p role="alert">{error}</p> : events.length === 0 ? <p className="competition-week-dialog__empty">No competitions this week.</p> :
          <ul className="competition-week-dialog__events">
            {events.map(row => <li key={row.id}>
              <Link to={competitionInvitePath(row.id)} aria-current={row.id === competitionId ? 'page' : undefined} onClick={onClose}>
                <time dateTime={row.starts_at!}><span>{dayLabel(clubCompetitionDay(row.starts_at)!, { weekday: 'short' })}</span><strong>{Number(clubCompetitionDay(row.starts_at)!.slice(-2))}</strong></time>
                <span><strong>{row.title}</strong><small>{formatClubTime(new Date(row.starts_at!))}{row.ends_at ? `–${formatClubTime(new Date(row.ends_at))}` : ''}</small></span>
                <ChevronRight aria-hidden="true" />
              </Link>
            </li>)}
          </ul>}
      </div>
    </dialog>, document.body,
  )
}

/** Visible event choices make the invite page an entry point to the whole week. */
function CompetitionWeekStrip({ competitionId }: { competitionId: string }) {
  const { rows, loading, error } = useCompetitionHubRows()
  const [anchor, setAnchor] = useState<string | null>(null)
  const current = rows.find(row => row.id === competitionId)
  const days = competitionWeekDays(anchor ?? clubCompetitionDay(current?.starts_at ?? null) ?? clubTodayDateInput())
  const events = rows.filter(row => {
    const day = clubCompetitionDay(row.starts_at)
    return day !== null && day >= days[0] && day <= days[6] && row.status !== 'cancelled'
  }).sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? ''))
  const label = (day: string, options: Intl.DateTimeFormatOptions) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' })

  return <nav className="competition-week-strip" aria-label="Weekly competitions"
    onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
    <button type="button" className="competition-week-strip__arrow" aria-label="Previous competition week" onClick={() => setAnchor(shiftCalendarDay(days[0], -7))}><ChevronLeft aria-hidden="true" /></button>
    <div className="competition-week-strip__events" aria-live="polite">
      {loading ? <p role="status">Loading competitions…</p> : error ? <p role="alert">Unable to load this week.</p> : events.length === 0 ?
        <p>{label(days[0], { day: 'numeric', month: 'short' })}–{label(days[6], { day: 'numeric', month: 'short' })}<span>No competitions</span></p> :
        events.map(row => {
          const day = clubCompetitionDay(row.starts_at)!
          const level = competitionLevelLabel(row) ?? 'Level not specified'
          const fixed = isDuoCompetition(row)
          const gender = row.gender === 'Women' ? 'Women only' : row.gender === 'Men' ? 'Men only' : fixed && row.scoring_config?.pair_gender_rule !== 'open' ? 'One man and one woman' : 'Open to men and women'
          const format = fixed ? 'Fixed partners' : 'Rotating partners'
          const hero = row.gender === 'Women' ? 'female-v4' : row.gender === 'Men' ? 'male-v4' : 'duo'
          const strength = row.skill_level_max_rank ?? ({ Beginner: 1, 'Low Inter': 2, Intermediate: 3, Inter: 3, 'High Inter': 4, Advanced: 5, 'Advanced Plus': 6 }[row.skill_level ?? ''] ?? 0)
          const time = `${formatClubTime(new Date(row.starts_at!))}${row.ends_at ? `–${formatClubTime(new Date(row.ends_at))}` : ''}`
          return <Link key={row.id} to={competitionInvitePath(row.id)}
            className="competition-week-strip__event" aria-current={row.id === competitionId ? 'page' : undefined}
            aria-label={`${label(day, { weekday: 'long', day: 'numeric', month: 'short' })}, ${time}, ${level}, ${gender}, ${format}`} title={`${level} · ${gender} · ${format}`}>
            <strong>{label(day, { weekday: 'short' })}</strong>
            <time dateTime={day}>{label(day, { day: 'numeric', month: 'short' })}</time>
            <span className="competition-week-strip__time">{time}</span>
            <span className="competition-week-strip__hero" aria-hidden="true"><img src={`/brand/superhero-americano-${hero}.png`} alt="" /><span className="competition-week-strip__strength">{[1, 2, 3, 4, 5, 6].map(rank => <i key={rank} data-filled={rank <= strength} />)}</span></span>
            <span className="competition-week-strip__traits" aria-hidden="true"><span>{row.gender === 'Women' ? '♀' : row.gender === 'Men' ? '♂' : '♂♀'}</span>{fixed ? <Link2 /> : <Shuffle />}</span>
          </Link>
        })}
    </div>
    <button type="button" className="competition-week-strip__arrow" aria-label="Next competition week" onClick={() => setAnchor(shiftCalendarDay(days[0], 7))}><ChevronRight aria-hidden="true" /></button>
  </nav>
}

/** Mobile calendar owns its visibility; shared headers keep one rendering path. */
export function CompetitionWeekCalendar({ competitionId, presentation = 'icon' }: { competitionId: string; presentation?: 'icon' | 'week' }) {
  const viewport = useViewportBucket()
  const [open, setOpen] = useState(false)
  if (presentation === 'week') return <CompetitionWeekStrip key={competitionId} competitionId={competitionId} />
  if (viewport !== 'mobile') return null
  return <div className="competition-week-browser" onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
    <button type="button" className="competition-week-browser__trigger" aria-label="Competition calendar" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><CalendarDays aria-hidden="true" /></button>
    {open ? <CalendarDialog competitionId={competitionId} onClose={() => setOpen(false)} /> : null}
  </div>
}
