import React from 'react'
import { createRoot } from 'react-dom/client'
import { PlayerCoachFeedback } from '../../src/foundation/profile/PlayerCoachFeedback'
import { supabase } from '../../src/lib/supabaseClient'
import '../../src/layouts/coach-feedback.layout.css'

// In-memory fixture only. Never issues observation requests to the live database.
const mode = new URLSearchParams(location.search).get('mode') || 'author'
const note = { id: 'fixture-note', player_id: 'fixture-player', coach_id: 'fixture-coach', created_at: '2026-09-17T10:00:00Z', transcript: 'Test only', coach: { display_name: 'Test coach' }, feedback: { observations: [
  { category: 'positioning', skill: 'Net position', kind: 'strength', observation: 'Good net position.', next_step: '', evidence: 'Test only' },
  { category: 'teamwork', skill: 'Communication', kind: 'strength', observation: 'Clear calls.', next_step: '', evidence: 'Test only' },
] } }
let rows = [note]
Object.assign(window, { fixtureDeletes: 0 })
supabase.auth.getSession = async () => ({ data: { session: { user: { id: 'fixture-coach' } } }, error: null }) as never
supabase.from = (() => {
  let deleting = false
  const query = { delete() { deleting = true; return query }, eq() { return query }, select() { return query }, order() { return query }, limit() { return query },
    then(resolve: (value: unknown) => void) {
      if (deleting) {
        Object.assign(window, { fixtureDeletes: (window as unknown as {fixtureDeletes:number}).fixtureDeletes + 1 })
        if (mode === 'failure') return resolve({ data: null, error: { message: 'Fixture failure' } })
        rows = []; return resolve({ data: [{ id: note.id }], error: null })
      }
      return resolve({ data: rows, error: null })
    },
  }; return query
}) as never
document.documentElement.dataset.viewport = window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : window.innerWidth < 1536 ? 'web' : 'tv'
createRoot(document.getElementById('root')!).render(<PlayerCoachFeedback playerId="fixture-player" revision={0} canView viewerId={mode === 'other' ? 'other-coach' : 'fixture-coach'} canDeleteOwn={mode !== 'player'} />)
