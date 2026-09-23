import type { CoachEntry, CoachObservation } from './coachFeedback'

export function observationRating(note: CoachObservation): number | null {
  return typeof note.rating === 'number' && Number.isInteger(note.rating)
    && note.rating >= 1 && note.rating <= 10
    && (note.rating_source === 'coach' || note.rating_source === 'estimated') ? note.rating : null
}

/** Every recording has equal weight; extra tags in one note must not dominate. */
export function skillRating(entries: CoachEntry[], category: string, skill?: string) {
  const recordingScores: number[] = []
  const seen = new Set<string>()
  let observations = 0
  let estimated = false
  for (const entry of entries) {
    if (seen.has(entry.id)) continue
    seen.add(entry.id)
    const notes = entry.feedback.observations.filter(note => note.category === category
      && (skill === undefined || note.skill === skill))
    observations += notes.length
    const scores = notes.flatMap(note => {
      const score = observationRating(note)
      if (score === null) return []
      if (note.rating_source === 'estimated') estimated = true
      return [score]
    })
    if (scores.length) recordingScores.push(scores.reduce((sum, score) => sum + score, 0) / scores.length)
  }
  return {
    score: recordingScores.length
      ? Math.round(recordingScores.reduce((sum, score) => sum + score, 0) / recordingScores.length * 10) / 10 : null,
    recordings: recordingScores.length, observations, estimated,
  }
}
