import accounts from '../../lib/halloweenAccounts.json'
import { Link, useSearchParams } from 'react-router-dom'
import { usePublicCompetition } from '../../hooks/usePublicCompetition'
import { competitionScheduleFromSession } from '../../lib/competitionScheduleLayout'
import { HALLOWEEN_PLAN } from '../../lib/competitionOperations'
import { halloweenSavedPlan } from '../../lib/halloweenSavedPlan'
import { rosterDisplayName } from '../../hooks/useCompetitions'
import { competitionPlayerAvatarUrl } from '../../lib/competitionRosterAvatars'
import { PlayerAvatarLink } from '../../shared/ProfilePhoto/PlayerAvatarLink'
import { halloweenPlayers, halloweenRounds } from '../../lib/halloweenNight'
import './halloween-night.css'

function Costume({ kind }: { kind: 'witch' | 'vampire' | 'bride' | 'skeleton' }) {
  return <span className="halloween-costume" data-costume={kind} role="img" aria-label={kind} />
}
function Pair({ woman, man }: { woman: 'witch' | 'bride'; man: 'vampire' | 'skeleton' }) {
  return <div className="halloween-pair"><Costume kind={woman} /><span aria-hidden="true">+</span><Costume kind={man} /></div>
}
export default function HalloweenNightPage() {
  const [params] = useSearchParams()
  const requestedId = params.get('competition')
  const eventId = requestedId && /^[a-f0-9-]{36}$/i.test(requestedId) ? requestedId : undefined
  const { session: event, roster: savedRoster, rounds: savedRounds, clubCourts, loading, error } = usePublicCompetition(eventId, {pollMs:15000})
  const groupIds = event?.scoring_config?.mixed_groups?.flat()
  const roster = groupIds ? groupIds.flatMap(id => { const p = savedRoster.find(p => p.id === id); return p ? [p] : [] }) : savedRoster
  const timing = event ? competitionScheduleFromSession(event) : HALLOWEEN_PLAN
  let plan = halloweenRounds.map(r => ({...r, labels:r.courts.map((_,i) => `Court ${i+1}`)}))
  let planError = error
  if (requestedId) {
    plan = []
    if (!eventId) planError = 'Invalid competition link.'
    else if (event) {
      try { plan = halloweenSavedPlan(event,roster,savedRounds,clubCourts) }
      catch (cause) { planError = cause instanceof Error ? cause.message : 'Saved matchups are unavailable.' }
    }
  }
  function player(slot: number) {
    const account = (accounts as Record<string, {name:string;profileId:string|null;padelPlayerId:string;avatarUrl:string|null}>)[slot]
    const p = requestedId ? roster[slot] : null
    const displayName = p ? rosterDisplayName(p) : ''
    const name = requestedId ? (displayName === 'Player' ? '' : displayName) : account?.name ?? halloweenPlayers[slot]
    const displayAccount = requestedId ? null : account
    return <span className="halloween-player" key={slot}>
      <PlayerAvatarLink displayName={name || 'Open place'} avatarUrl={p ? competitionPlayerAvatarUrl(p) : displayAccount?.avatarUrl} profileId={p?.profile_id ?? displayAccount?.profileId} padelPlayerId={p?.padel_player_id ?? displayAccount?.padelPlayerId} competitionId={event?.id} disabled={!displayAccount && !p} imgClassName="halloween-player__photo" />
      <span>{name || `Open place ${slot + 1}`}</span>
    </span>
  }
  return <main className="halloween-night" data-scroll-y>
    <header className="halloween-night__hero">
      <Link to="/competitive"><img className="halloween-night__logo" src="/brand/halloween/logo-pumpkin.png" alt="Success Padel Samui" /></Link>
      <p>Saturday 31 October · Success Padel Samui</p>
      <h1>Halloween<br /><em>on court.</em></h1>
      <p>Dress up. Mix it up. Play for the night.</p>
      <div className="halloween-night__facts"><strong>{plan[0]?.start ?? HALLOWEEN_PLAN.start}–{plan.at(-1)?.end ?? HALLOWEEN_PLAN.end}</strong><strong>500 THB / player</strong><strong>Low intermediate</strong></div>
    </header>
    <section className="halloween-night__section"><h2>New partner. Every game.</h2>
      <div className="halloween-switch">
        <article><h3>Game 1</h3><Pair woman="witch" man="vampire" /><Pair woman="bride" man="skeleton" /></article>
        <div className="halloween-switch__arrow" aria-label="Switch partners">↔</div>
        <article><h3>Game 2</h3><Pair woman="witch" man="skeleton" /><Pair woman="bride" man="vampire" /></article>
      </div>
      <div className="halloween-visual-facts"><div><span className="halloween-population" aria-hidden="true">{Array.from({length:8},(_,i)=><i key={i}>♀</i>)}</span><strong>8 women</strong></div><div><span className="halloween-population" aria-hidden="true">{Array.from({length:8},(_,i)=><i key={i}>♂</i>)}</span><strong>8 men</strong></div><div><span className="halloween-clock" aria-hidden="true">◷<b>{timing.gameMinutes}</b></span><strong>{timing.games} games · {timing.gameMinutes} min</strong></div><div><span className="halloween-round-dots" aria-hidden="true">● ● ● ● ● ● ● ●</span><strong>{timing.breakMinutes} min to switch</strong></div></div>
    </section>
    <section className="halloween-night__section"><h2>Come in costume.</h2><div className="halloween-costume-lineup"><Costume kind="witch" /><Costume kind="vampire" /><Costume kind="bride" /><Costume kind="skeleton" /></div><p>Players & spectators · Costume prizes</p><div className="halloween-night__prizes"><p><strong>Tournament</strong><span>1st · 3,000 THB</span><span>2nd · 2,000 THB</span><span>3rd · 1,000 THB</span></p><p><strong>Costumes</strong><span>Best · 3,000 THB</span><span>Runner-up · 2,000 THB</span></p></div></section>
    <section className="halloween-night__section"><h2>The lineup</h2><div className="halloween-lineup-groups">{['Men', 'Women'].map((group, groupIndex) => <div key={group}><h3>{group} · {Array.from({length:8},(_,i) => groupIndex*8+i).filter(i => requestedId ? Boolean(roster[i] && ! /^(Player|Open place \d+)$/.test(rosterDisplayName(roster[i]))) : Boolean(halloweenPlayers[i])).length} / 8</h3><ol className="halloween-night__roster">{Array.from({length:8},(_,index) => <li key={index}><span className="halloween-lineup-number">{index + 1}</span>{player(groupIndex * 8 + index)}</li>)}</ol></div>)}</div></section>
    <section className="halloween-night__section"><h2>Your night, round by round.</h2>{planError && <p role="alert">{planError}</p>}{loading && <p role="status">Loading…</p>}{plan.map(round => <article className="halloween-round" key={round.number}><header><h3>Game {round.number}</h3><strong>{round.start}–{round.end}</strong></header><div className="halloween-round__courts">{round.courts.map((slots, court) => <div className="halloween-court" key={court}><h4>{round.labels[court]}</h4><div>{player(slots[0])}{player(slots[1])}</div><b>vs</b><div>{player(slots[2])}{player(slots[3])}</div></div>)}</div></article>)}</section>
  </main>
}
