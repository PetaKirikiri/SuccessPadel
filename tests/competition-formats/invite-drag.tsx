import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../src/providers/AuthProvider'
import { LocaleProvider } from '../../src/providers/LocaleProvider'
import { ViewportProvider } from '../../src/contexts/ViewportContext'
import { InviteCardRosterEditor } from '../../src/components/InviteCard/InviteCardRosterEditor'
import type { CompetitionRow, CompetitionPlayer } from '../../src/hooks/useCompetitions'
import { occupantsInFixedSlots } from '../../src/lib/competitionLineupOrder'
import { supabase } from '../../src/lib/supabaseClient'
import '../../src/index.css'
import './invite-drag.css'

// Isolated transport: no database writes; persists across reloads for browser QA.
supabase.auth.getSession = async () => ({data:{session:null},error:null})
supabase.auth.getUser = async () => ({data:{user:null},error:null}) as any
const key = 'editable-invite-drag-fixture'
const initial = Array.from({length: 16}, (_, i) => ({
  id: `slot-${i}`, rank_order: i, guest_name: `Player ${i + 1}`, profile_id: null,
  padel_player_id: null, guest_email: null, profiles: null,
})) as CompetitionPlayer[]
initial[0] = {...initial[0], guest_name: null, profile_id: 'member-1', profiles: {
  id: 'member-1', display_name: 'Linked player', avatar_url: '/favicon.svg',
}}
let saved: CompetitionPlayer[] = JSON.parse(localStorage.getItem(key) ?? 'null') ?? initial
const row = () => ({id:'fixture-only', status:'open', partnership_mode:'americano', max_players:16,
  scoring_config:{competition_player_mode:'singles'}, session_players:saved, session_pairs:[], competition_started_at:null}) as CompetitionRow
let fail = false
supabase.rpc = (async () => ({data:[row()],error:null})) as typeof supabase.rpc
supabase.from = (() => ({select:()=>({order:async()=>({data:[],error:null}),eq:async()=>({data:[],error:null})})})) as typeof supabase.from
const invoke = async (_name: string, {body}: any) => {
  if (fail) return {data:{error:'Test save rejected'},error:null}
  if(body.action !== 'reorder') return {data:{error:'Name editing not simulated'},error:null}
  const expected = saved.map(p=>({id:p.id,rank_order:p.rank_order,profile_id:p.profile_id??null,padel_player_id:p.padel_player_id??null,guest_name:p.guest_name??null}))
  if (JSON.stringify(expected)!==JSON.stringify(body.expectedSlots)) return {data:{error:'The lineup was changed elsewhere. Refresh before trying again'},error:null}
  saved = occupantsInFixedSlots(saved,body.occupantOrder.map((id:string)=>saved.find(p=>p.id===id)!))
  localStorage.setItem(key,JSON.stringify(saved))
  return {data:{saved:true},error:null}
}
Object.defineProperty(supabase, 'functions', {value:{invoke},configurable:true})
function Fixture() {
  const [reject, setReject] = useState(false)
  return <main>
    <label><input type="checkbox" checked={reject} onChange={e=>{fail=e.target.checked;setReject(fail)}}/>Reject saves</label>
    <div className="invite-game-card" data-kind="competition" data-competition-format="singles">
      <div className="invite-game-card__frame"><div className="competition-pregame"><section className="competition-pregame__players">
        <InviteCardRosterEditor row={row()} publicSignup />
      </section></div></div>
    </div>
  </main>
}
createRoot(document.getElementById('root')!).render(<MemoryRouter><AuthProvider><LocaleProvider><ViewportProvider><Fixture/></ViewportProvider></LocaleProvider></AuthProvider></MemoryRouter>)
