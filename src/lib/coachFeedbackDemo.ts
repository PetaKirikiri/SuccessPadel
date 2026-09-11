import type { CoachEntry, CoachObservation } from './coachFeedback'

// Fictional UI sample only. Never written to the database or used as an assessment.
const samples: CoachObservation[] = [
  { category: 'positioning', skill: 'Net position', kind: 'strength', observation: 'DEMO: Dave follows a deep lob forward and takes a strong net position.', next_step: 'Keep moving forward with your partner after a good lob.', evidence: '' },
  { category: 'selection', skill: 'Risk & patience', kind: 'improvement', observation: 'DEMO: Dave sometimes tries to finish from a low ball instead of rebuilding the point.', next_step: 'On a low contact, aim safely through the middle and wait for a higher ball.', evidence: '' },
  { category: 'attack', skill: 'Volleys', kind: 'strength', observation: 'DEMO: Dave uses a compact forehand volley to keep opponents at the back.', next_step: 'Keep the preparation short and prioritise depth over power.', evidence: '' },
  { category: 'defence', skill: 'Back & double glass', kind: 'improvement', observation: 'DEMO: Dave rushes the ball before letting it come away from the back glass.', next_step: 'Practise letting a gentle feed rebound before setting up the return.', evidence: '' },
  { category: 'movement', skill: 'Split step', kind: 'improvement', observation: 'DEMO: Dave is occasionally still moving as his opponent strikes, making the next change of direction harder.', next_step: 'Try a small split step timed to the opponent’s contact.', evidence: '' },
  { category: 'teamwork', skill: 'Communication', kind: 'strength', observation: 'DEMO: Dave calls early for balls through the middle and encourages his partner.', next_step: 'Keep those early calls, especially when moving back for a lob.', evidence: '' },
]

export function demoCoachEntry(playerId: string): CoachEntry {
  return {
    id: 'local-fictional-dave-demo', player_id: playerId,
    created_at: '2026-09-11T12:00:00+07:00',
    transcript: 'FICTIONAL DEMO — invented to preview the interface, not a real observation of Dave. No recording or AI assessment was performed.',
    coach: { display_name: 'Fictional demo' },
    feedback: { observations: samples },
  }
}
