import { useEffect, useId, useState } from 'react'
import { Crosshair, Signpost, Shield, Footprints, UsersRound, MoveUpRight, MessageSquare, CalendarPlus } from 'lucide-react'
import skills from '../../lib/coachSkills.json'
import { loadCoachEntries, type CoachEntry } from '../../lib/coachFeedback'
import { demoCoachEntry } from '../../lib/coachFeedbackDemo'

const icons = { positioning: Crosshair, selection: Signpost, attack: MoveUpRight, defence: Shield, movement: Footprints, teamwork: UsersRound }
const attributes = skills.map(skill => ({ ...skill, icon: icons[skill.id as keyof typeof icons] }))
const kindLabel = { strength: 'Strength', improvement: 'Work on', observation: 'Observation' }

export function PlayerCoachFeedback({ playerId, revision, canView, demo = false }: { playerId: string | null; revision: number; canView: boolean; demo?: boolean }) {
  const [selectedId, setSelectedId] = useState('positioning')
  const [entries, setEntries] = useState<CoachEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [bookingNote, setBookingNote] = useState<string | null>(null)
  const panelId = useId()
  useEffect(() => {
    let active = true
    setEntries([]); setError(null)
    if (demo) {
      setEntries([demoCoachEntry(playerId ?? 'local-dave-preview')]); setLoading(false)
      return
    }
    if (!playerId || !canView) { setLoading(false); return }
    setLoading(true)
    void loadCoachEntries(playerId).then(rows => {
      if (!active) return
      setEntries(rows)
      const first = rows[0]?.feedback.observations[0]?.category
      if (first) setSelectedId(first)
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not load feedback.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [playerId, revision, canView, retry, demo])
  const selected = attributes.find(attribute => attribute.id === selectedId) ?? attributes[0]
  const SelectedIcon = selected.icon
  const observations = entries.flatMap(entry => entry.feedback.observations
    .filter(note => note.category === selectedId).map((note, index) => ({ entry, note, index })))
  return (
    <section className="padel-skill-sheet" aria-label="Padel skill profile">
      <header className="padel-skill-sheet__heading"><h2>Skill profile</h2><span>Tap a skill to explore</span></header>
      <div className="padel-skill-sheet__attributes" role="group" aria-label="Padel attributes">
        {attributes.map(({ id, code, name, icon: Icon, hint }) => {
          const count = entries.reduce((sum, entry) => sum + entry.feedback.observations.filter(note => note.category === id).length, 0)
          return <button key={id} type="button" className="padel-skill-tile" data-skill={id}
            aria-pressed={selectedId === id} aria-controls={panelId} onClick={() => setSelectedId(id)}>
            <span className="padel-skill-tile__crest"><Icon aria-hidden="true" /></span>
            <span className="padel-skill-tile__body"><strong>{name}</strong><span>{count ? `${count} observation${count === 1 ? '' : 's'}` : hint}</span></span>
            <span className="padel-skill-tile__code" aria-hidden="true">{code}</span>
          </button>
        })}
      </div>
      <section className="padel-skill-detail" id={panelId} data-skill={selected.id} aria-label={selected.name}>
        <header><SelectedIcon aria-hidden="true" /><h3>{selected.name}</h3><span>{observations.length ? 'Coach observations' : 'Not assessed'}</span></header>
        <ul className="padel-skill-detail__branches">
          {selected.skills.map(skill => {
            const count = observations.filter(({ note }) => note.skill === skill).length
            return <li key={skill}><span className="padel-skill-detail__node" aria-hidden="true" /><span>{skill}</span><span aria-label={count ? `${count} observations` : 'Not assessed'}>{count || '—'}</span></li>
          })}
        </ul>
        {loading ? <p className="coach-feedback-message" role="status">Loading observations…</p> : error ? <div className="coach-feedback-message" role="alert">{error}<button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></div> : observations.length ? (
          <div className="coach-observation-list">{observations.map(({ entry, note, index }) => (
            <article className="coach-observation" key={`${entry.id}-${index}`} id={`observation-${entry.id}-${index}`} data-kind={note.kind}>
              <header><strong>{kindLabel[note.kind]}</strong><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleDateString()}</time></header>
              <div className="coach-comment">
                <span className="coach-comment__avatar" aria-hidden="true">{(entry.coach?.display_name || 'Coach').charAt(0)}</span>
                <div className="coach-comment__body">
                  <strong>{demo ? 'Coach · example' : entry.coach?.display_name || 'Coach'}</strong>
                  <blockquote><em>“{note.observation.replace(/^DEMO: /, '')}”</em></blockquote>
                </div>
                {demo ? <span className="coach-comment__score" aria-label="Example skill score out of 10"><strong>{note.kind === 'strength' ? '7' : '5'}</strong><span>/10</span></span> : null}
              </div>
              {note.next_step ? <p className="coach-observation__next">{note.next_step}</p> : null}
              <div className="coach-observation__booking">
                <button type="button" onClick={() => setBookingNote(`${entry.id}-${index}`)} aria-label={`Book lesson: ${note.skill}`}>
                  <CalendarPlus aria-hidden="true" /> Book lesson
                </button>
                {bookingNote === `${entry.id}-${index}` ? <p role="status">Please speak to reception to arrange a lesson on {note.skill.toLowerCase()}. Online booking isn’t available yet.</p> : null}
              </div>
            </article>
          ))}</div>
        ) : <div className="padel-skill-detail__observations"><MessageSquare aria-hidden="true" /><span>{canView ? 'No coach observations for this skill yet' : 'Feedback is private to the player and authorised staff.'}</span></div>}
        {!loading && !error ? entries.filter(entry => entry.feedback.observations.length === 0).map(entry => <details key={entry.id} className="coach-observation"><summary>Saved note · no clear skill observation</summary><p>{entry.transcript}</p><footer>{entry.coach?.display_name || 'Coach'} · {new Date(entry.created_at).toLocaleDateString()}</footer></details>) : null}
      </section>
    </section>
  )
}
