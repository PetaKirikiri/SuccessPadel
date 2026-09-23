import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { usePublicCompetition } from '../../hooks/usePublicCompetition'
import { buildRosterNameById, rosterDisplayName } from '../../hooks/useCompetitions'
import { supabase } from '../../lib/supabaseClient'
import { competitionPlayerAvatarUrl } from '../../lib/competitionRosterAvatars'
import { nearestCompetitionId, type HomepageCompetition } from '../../lib/nearestCompetition'
import { coachCompetitionFromPath, coachGameLineup, initialCoachRound } from '../../lib/coachGameLineup'
import { CoachesCommentView } from './CoachesCommentView'

export function CoachesCommentPage() {
  const { user, loading: authLoading } = useAuth()
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const requestedId = coachCompetitionFromPath(`/coaches-comment?${params}`)
  const [permission, setPermission] = useState<{ viewer: string; allowed: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const viewerId = user?.id
  const allowed = Boolean(user && permission?.viewer === user.id && permission.allowed)
  useEffect(() => {
    let current = true
    if (!viewerId) return
    void supabase.rpc('can_record_coach_feedback').then(({ data, error: failure }) => {
      if (!current) return
      if (failure) setError('Could not check coach access. Please retry.')
      else { setError(null); setPermission({ viewer: viewerId, allowed: data === true }) }
    })
    return () => { current = false }
  }, [viewerId, retry])
  useEffect(() => {
    if (!allowed || requestedId) return
    let current = true
    // Read only: the hub loader also links guest rosters, which this screen must not do.
    void supabase.rpc('list_competitions_for_setup').then(({ data, error: failure }) => {
      if (!current) return
      const nearest = !failure ? nearestCompetitionId((data ?? []) as HomepageCompetition[]) : null
      if (nearest) setParams({ competition: nearest }, { replace: true, state: location.state })
      else setError(failure ? 'Could not load the current competition. Please retry.' : 'No competition is available.')
    })
    return () => { current = false }
  }, [allowed, requestedId, retry, setParams, location.state])
  const returnState = location.state as { from?: string; profileState?: unknown } | null
  const from = returnState?.from
  const onBack = () => from && (from.startsWith('/players/') || from === '/competitive' || coachCompetitionFromPath(from))
    ? navigate(from, { state: returnState?.profileState }) : navigate('/profile')
  if (error || !allowed || !requestedId) return <section className="coaches-comment">
    <header className="coaches-comment__header"><button type="button" onClick={onBack} aria-label="Back"><ArrowLeft aria-hidden="true" /></button><h1>Coaches Comment</h1></header>
    <p role="status">{error ?? (authLoading ? 'Loading…' : !user ? 'Sign in with your coach account to record comments.' : permission?.viewer === user.id && !permission.allowed ? 'Coach access is required to record comments.' : 'Loading tonight’s players…')}</p>
    {error ? <button type="button" className="coaches-comment__retry" onClick={() => { setError(null); setRetry(value => value + 1) }}>Retry</button> : null}
  </section>
  return <CompetitionComments key={`${user!.id}:${requestedId}`} competitionId={requestedId} onBack={onBack} />
}

function CompetitionComments({ competitionId, onBack }: { competitionId: string; onBack: () => void }) {
  const data = usePublicCompetition(competitionId, { pollMs: false })
  if (data.loading || !data.session) return <section className="coaches-comment"><button className="coaches-comment__retry" type="button" onClick={onBack}>Back</button><p role="status">{data.error ?? 'Loading tonight’s players…'}</p>{data.error ? <button className="coaches-comment__retry" type="button" onClick={() => void data.refresh()}>Retry</button> : null}</section>
  return <LoadedCompetitionComments data={data} competitionId={competitionId} onBack={onBack} />
}

function LoadedCompetitionComments({ data, competitionId, onBack }: {
  data: ReturnType<typeof usePublicCompetition>; competitionId: string; onBack: () => void
}) {
  const { session, roster, rounds, clubCourts, leaderboard } = data
  const [params] = useSearchParams()
  // Choose once on entry. Clock ticks, score changes and other viewers cannot advance this list.
  const [roundId, setRoundId] = useState(() => initialCoachRound(rounds, Number(params.get('game')) || null))
  const [saved, setSaved] = useState<Set<string>>(() => new Set())
  const ordered = useMemo(() => [...rounds].sort((a, b) => a.round_number - b.round_number), [rounds])
  const round = rounds.find(value => value.id === roundId)
  const players = useMemo(() => {
    const names = buildRosterNameById(roster, leaderboard)
    return roster.map(player => ({ id: player.id, playerId: player.padel_player_id,
      profileId: player.profile_id, name: names.get(player.id) ?? rosterDisplayName(player), avatarUrl: competitionPlayerAvatarUrl(player) }))
  }, [roster, leaderboard])
  const lineup = useMemo(() => coachGameLineup(round, players, clubCourts), [round, players, clubCourts])
  const index = ordered.findIndex(value => value.id === roundId)
  return <CoachesCommentView competitionId={competitionId} title={session?.title || 'Competition'} gameNumber={round?.round_number ?? null}
    playerCount={players.length} courts={lineup.courts} unassigned={lineup.unassigned} saved={saved}
    onSaved={id => setSaved(previous => new Set([...previous, id]))} onBack={onBack}
    onPrevious={index > 0 ? () => setRoundId(ordered[index - 1].id) : undefined}
    onNext={index >= 0 && index < ordered.length - 1 ? () => setRoundId(ordered[index + 1].id) : undefined} />
}
