import { Search, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { type DirectoryMember, type DirectoryPatch } from '../lib/memberDirectory'
import { eligibleForRanking, type RankingBoard } from '../lib/memberRankingBoard'
import { supabase } from '../lib/supabaseClient'
import { MemberDirectoryCard } from './PublicMemberDirectory'
import '../layouts/member-rankings.layout.css'
import '../layouts/members.layout.css'

type MatchRecord = { id: string; games: number; wins: number; draws: number }

async function listRecentRankings(ids: string[], signal: AbortSignal): Promise<MatchRecord[]> {
  const cutoff = new Date()
  const day = cutoff.getUTCDate()
  cutoff.setUTCDate(1)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 2)
  const endOfMonth = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0))
  cutoff.setUTCDate(Math.min(day, endOfMonth.getUTCDate()))

  const records: MatchRecord[] = []
  const pending = ids.values()
  await Promise.all(Array.from({ length: Math.min(8, ids.length) }, async () => {
    for (const id of pending) {
      if (signal.aborted) return
      const { data, error } = await supabase.rpc('get_player_match_history', { p_player_id: id }).abortSignal(signal)
      if (error) throw error
      const games = new Map<string, { won: boolean; score_summary: string }>()
      for (const match of data ?? []) {
        if (Date.parse(match.played_at) >= cutoff.getTime() && match.score_summary?.trim()) {
          games.set(match.match_id, match)
        }
      }
      if (!games.size) continue
      const results = [...games.values()]
      records.push({
        id,
        games: results.length,
        wins: results.filter(match => match.won).length,
        draws: results.filter(match => {
          const score = match.score_summary.trim().match(/^(\d+)\s*[-–:]\s*(\d+)$/)
          return !match.won && Boolean(score && Number(score[1]) === Number(score[2]))
        }).length,
      })
    }
  }))
  return records
}

// Four even results temper small samples so a single win cannot dominate the board.
function startingScore(record: MatchRecord): number {
  return (record.wins + record.draws / 2 + 2) / (record.games + 4)
}

type Props = {
  members: DirectoryMember[]; canEdit: boolean; ownerToken: string | null; loading: boolean; error: string | null
  onSave?: (id: string, patch: DirectoryPatch) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onUploadPhoto?: (id: string, file: File) => Promise<string>
}
export function MemberRankings({ members, canEdit, ownerToken, loading, error, onSave, onDelete, onUploadPhoto }: Props) {
  const [board, setBoard] = useState<RankingBoard>('all')
  const [ranks, setRanks] = useState<MatchRecord[]>([])
  const [rankLoading, setRankLoading] = useState(true)
  const [rankError, setRankError] = useState('')
  const [search, setSearch] = useState('')
  const request = useRef<AbortController | null>(null)
  const memberIds = members.filter(member => eligibleForRanking(member, 'all')).map(member => member.id).sort().join(',')
  const ids = useMemo(() => memberIds ? memberIds.split(',') : [], [memberIds])
  const refresh = useCallback(async () => {
    if (loading) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setRankLoading(true)
    setRankError('')
    try {
      const result = await listRecentRankings(ids, controller.signal)
      if (!controller.signal.aborted) setRanks(result)
    } catch {
      if (!controller.signal.aborted) {
        setRankError('Could not load rankings.')
        setRanks([])
      }
    } finally {
      if (!controller.signal.aborted) setRankLoading(false)
    }
  }, [ids, loading])
  useEffect(() => {
    void refresh()
    return () => request.current?.abort()
  }, [refresh])
  const eligible = members.filter(m => eligibleForRanking(m, board))
  const byId = new Map(eligible.map(m => [m.id, m]))
  const homeRanks = ranks.filter(record => byId.has(record.id))
    .sort((a, b) => startingScore(b) - startingScore(a) || b.games - a.games || a.id.localeCompare(b.id))
  const rows = homeRanks.map((record, index) => ({ ...record, position: index + 1, member: byId.get(record.id)! }))
    .filter(({ member }) => member.display_name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  const isLoading = loading || rankLoading
  return <section className="member-rankings">
    <nav className="member-rankings__navigation" aria-label="Players and rankings"><Link to={`/members${ownerToken ? `#owner=${encodeURIComponent(ownerToken)}` : ''}`}>Players</Link><span aria-current="page">Rankings</span></nav>
    <header className="member-rankings__header"><Trophy aria-hidden="true" /><div><p>SUCCESS PADEL</p><h1>PLAYER RANKINGS</h1></div><span>{isLoading ? '—' : homeRanks.length}</span></header>
    <div className="member-rankings__boards" role="group" aria-label="Ranking lists">{(['all', 'men', 'women'] as const).map(value => <button key={value} type="button" aria-pressed={board === value} onClick={() => { setBoard(value); setSearch('') }}>{value === 'all' ? 'All' : value === 'men' ? 'Men' : 'Women'}</button>)}</div>
    <p>Scored games in the past two months. Rankings are provisional.</p>
    <div className="member-rankings__toolbar">
      <label className="member-rankings__search"><Search aria-hidden="true" /><input type="search" aria-label="Search ranked players" placeholder="Search players" value={search} onChange={e => setSearch(e.target.value)} /></label>
    </div>
    {error || rankError ? <div className="member-rankings__empty" role="alert">{error || rankError}{rankError ? <button type="button" onClick={() => void refresh()}>Retry</button> : null}</div> : isLoading ? <p role="status">Loading rankings…</p> : <>
      <ol className="member-rankings__list">{rows.map(({ id, position, member, games, wins, draws }) => <li className="member-rankings__card-row" key={id}>
        <div className="member-rankings__rank-handle">
          <strong className="member-rankings__position" aria-label={`Rank ${position}`}>{position}</strong>
          <span>{wins} won · {draws} drawn · {games} played</span>
        </div>
        <div className="member-directory__card" data-editable={canEdit}><MemberDirectoryCard member={member} canEdit={canEdit} onSave={onSave} onDelete={onDelete} onUploadPhoto={onUploadPhoto} /></div>
      </li>)}</ol>
      {!rows.length ? <p className="member-rankings__empty">{search.trim() ? 'No matching players.' : 'No scored games in the past two months.'}</p> : null}
    </>}
  </section>
}
