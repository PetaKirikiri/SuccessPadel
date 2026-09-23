import { useEffect, useId, useState } from 'react'
import { Crosshair, Signpost, Shield, Footprints, UsersRound, MoveUpRight, MessageSquare, CalendarPlus } from 'lucide-react'
import skills from '../../lib/coachSkills.json'
import { deleteCoachEntry, loadCoachEntries, type CoachEntry } from '../../lib/coachFeedback'
import { demoCoachEntry } from '../../lib/coachFeedbackDemo'
import { observationRating, skillRating } from '../../lib/coachSkillRatings'

const icons = { positioning: Crosshair, selection: Signpost, attack: MoveUpRight, defence: Shield, movement: Footprints, teamwork: UsersRound }
const attributes = skills.map(skill => ({ ...skill, icon: icons[skill.id as keyof typeof icons] }))
const kindLabel = { strength: 'Strength', improvement: 'Work on', observation: 'Observation' }

export function PlayerCoachFeedback({ playerId, revision, viewerId, canDeleteOwn = false, demo = false }: { playerId: string | null; revision: number; viewerId?: string; canDeleteOwn?: boolean; demo?: boolean }) {
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  async function removeEntry(entry: CoachEntry) {
    if (deleting || demo || !canDeleteOwn || !viewerId || entry.coach_id !== viewerId) return
    if (confirmDelete !== entry.id) return
    setDeleting(entry.id); setDeleteError(null)
    try {
      await deleteCoachEntry(entry.id, entry.player_id)
      setEntries(rows => rows.filter(row => row.id !== entry.id))
      setConfirmDelete(null)
    } catch (e) { setDeleteError(e instanceof Error ? e.message : 'Could not delete feedback.') }
    finally { setDeleting(null) }
  }
  const deleteAction = (entry: CoachEntry) => !demo && canDeleteOwn && viewerId && viewerId === entry.coach_id ? (
    confirmDelete === entry.id ? <>
      <p role="status">Delete this note and all its skill tags? This cannot be undone.</p>
      <button type="button" disabled={deleting !== null} onClick={() => setConfirmDelete(null)} aria-label="Cancel deleting coach note">Cancel</button>
      <button type="button" disabled={deleting !== null} onClick={() => void removeEntry(entry)} aria-label="Confirm delete coach note">
        {deleting === entry.id ? 'Deleting…' : 'Delete'}
      </button>
    </> : <button type="button" disabled={deleting !== null} onClick={() => { setConfirmDelete(entry.id); setDeleteError(null) }} aria-label="Delete this coach note and its skill observations">Delete note</button>
  ) : null
  const [selectedId, setSelectedId] = useState('positioning')
  const [entries, setEntries] = useState<CoachEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [bookingNote, setBookingNote] = useState<string | null>(null)
  const panelId = useId()
  useEffect(() => {
    let active = true
    setEntries([]); setError(null); setDeleteError(null); setConfirmDelete(null)
    if (demo) {
      setEntries([demoCoachEntry(playerId ?? 'local-dave-preview')]); setLoading(false)
      return
    }
    if (!playerId) { setLoading(false); return }
    setLoading(true)
    void loadCoachEntries(playerId).then(rows => {
      if (!active) return
      setEntries(rows)
      const first = rows[0]?.feedback.observations[0]?.category
      if (first) setSelectedId(first)
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not load feedback.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [playerId, revision, retry, demo])
  const selected = attributes.find(attribute => attribute.id === selectedId) ?? attributes[0]
  const SelectedIcon = selected.icon
  const selectedRating = skillRating(entries, selectedId)
  const observations = entries.flatMap(entry => entry.feedback.observations
    .filter(note => note.category === selectedId).map((note, index) => ({ entry, note, index })))
  return (
    <section className="padel-skill-sheet" aria-label="Padel skill profile">
      <header className="padel-skill-sheet__heading"><h2>Skill profile</h2><span>Tap a skill to explore</span></header>
      <div className="padel-skill-sheet__attributes" role="group" aria-label="Padel attributes">
        {attributes.map(({ id, code, name, icon: Icon, hint }) => {
          const rating = skillRating(entries, id)
          const count = rating.observations
          return <button key={id} type="button" className="padel-skill-tile" data-skill={id}
            aria-pressed={selectedId === id} aria-controls={panelId} onClick={() => setSelectedId(id)}>
            <span className="padel-skill-tile__crest"><Icon aria-hidden="true" /></span>
            <span className="padel-skill-tile__body"><strong>{name}{rating.score !== null ? ` · ${rating.score}/10` : ''}</strong><span>{count ? `${count} observation${count === 1 ? '' : 's'}` : hint}</span></span>
            <span className="padel-skill-tile__code" aria-hidden="true">{code}</span>
          </button>
        })}
      </div>
      <section className="padel-skill-detail" id={panelId} data-skill={selected.id} aria-label={selected.name}>
        {deleteError ? <p className="coach-feedback-message" role="alert">{deleteError}</p> : null}
        <header><SelectedIcon aria-hidden="true" /><h3>{selected.name}</h3><span title="Average of assessed recordings; unscored notes are excluded">{selectedRating.score !== null ? `${selectedRating.score}/10 · ${selectedRating.recordings} rated note${selectedRating.recordings === 1 ? '' : 's'}${selectedRating.estimated ? ' · AI-assisted' : ''}` : 'Not rated'}</span></header>
        <ul className="padel-skill-detail__branches">
          {selected.skills.map(skill => {
            const rating = skillRating(entries, selectedId, skill)
            return <li key={skill}><span className="padel-skill-detail__node" aria-hidden="true" /><span>{skill}</span><span aria-label={rating.score !== null ? `${rating.score} out of 10, from ${rating.recordings} rated notes` : 'Not rated'}>{rating.score !== null ? `${rating.score}/10` : '—'}</span></li>
          })}
        </ul>
        {loading ? <p className="coach-feedback-message" role="status">Loading observations…</p> : error ? <div className="coach-feedback-message" role="alert">{error}<button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></div> : observations.length ? (
          <div className="coach-observation-list">{observations.map(({ entry, note, index }) => (
            <article className="coach-observation" key={`${entry.id}-${index}`} id={`observation-${entry.id}-${index}`} data-kind={note.kind}>
              <header><strong>{kindLabel[note.kind]}{observationRating(note) !== null ? note.rating_source === 'estimated' ? ' · AI estimate' : ' · Coach rated' : ''}</strong><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleDateString()}</time></header>
              <div className="coach-comment">
                <span className="coach-comment__avatar" aria-hidden="true">{(entry.coach?.display_name || 'Coach').charAt(0)}</span>
                <div className="coach-comment__body">
                  <strong>{demo ? 'Coach · example' : entry.coach?.display_name || 'Coach'}</strong>
                  <blockquote><em>“{note.observation.replace(/^DEMO: /, '')}”</em></blockquote>
                </div>
                {observationRating(note) !== null ? <span className="coach-comment__score" aria-label={`${note.rating} out of 10, ${note.rating_source === 'estimated' ? 'AI estimate' : 'coach rating'}`}><strong>{note.rating}</strong><span>/10</span></span> : null}
              </div>
              {note.next_step ? <p className="coach-observation__next">{note.next_step}</p> : null}
              <div className="coach-observation__booking">
                {deleteAction(entry)}
                <button type="button" onClick={() => setBookingNote(`${entry.id}-${index}`)} aria-label={`Book lesson: ${note.skill}`}>
                  <CalendarPlus aria-hidden="true" /> Book lesson
                </button>
                {bookingNote === `${entry.id}-${index}` ? <p role="status">Please speak to reception to arrange a lesson on {note.skill.toLowerCase()}. Online booking isn’t available yet.</p> : null}
              </div>
            </article>
          ))}</div>
        ) : <div className="padel-skill-detail__observations"><MessageSquare aria-hidden="true" /><span>No coach observations for this skill yet</span></div>}
        {!loading && !error ? entries.filter(entry => entry.feedback.observations.length === 0).map(entry => <details key={entry.id} className="coach-observation"><summary>Saved note · no clear skill observation</summary><p>{entry.transcript}</p><footer>{entry.coach?.display_name || 'Coach'} · {new Date(entry.created_at).toLocaleDateString()}</footer><div className="coach-observation__booking">{deleteAction(entry)}</div></details>) : null}
      </section>
    </section>
  )
}
