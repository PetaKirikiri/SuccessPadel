import { Search, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { type DirectoryMember } from '../lib/memberDirectory'
import { eligibleForRanking, type RankingBoard } from '../lib/memberRankingBoard'
import { supabase } from '../lib/supabaseClient'
import { useRankingDrag } from './useRankingDrag'
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

const TIERS = ['Advanced', 'High Intermediate', 'Intermediate', 'Low Intermediate', 'Beginner'] as const

type Props = {
  members: DirectoryMember[]; canEdit: boolean; ownerToken: string | null; loading: boolean; error: string | null
}

export function MemberRankings({ members, canEdit, ownerToken, loading, error }: Props) {
  const [board, setBoard] = useState<RankingBoard>('all')
  const [ranks, setRanks] = useState<MatchRecord[]>([])
  const [rankLoading, setRankLoading] = useState(true)
  const [rankError, setRankError] = useState('')
  const [search, setSearch] = useState('')
  const [placements, setPlacements] = useState<Partial<Record<RankingBoard, Record<string, string[]>>>>(() => {
    try { return JSON.parse(localStorage.getItem('success-padel:ranking-tiers') ?? '{}') ?? {} }
    catch { return {} }
  })
  const [orderMessage, setOrderMessage] = useState('')
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
  const suggested = ranks.filter(record => byId.has(record.id))
    .sort((a, b) => startingScore(b) - startingScore(a) || b.games - a.games || a.id.localeCompare(b.id))
  const order = canEdit ? placements[board] ?? {} : {}
  const assigned = new Set(TIERS.flatMap(tier => order[tier] ?? []))
  const tiers = TIERS.map(tier => {
    const saved = (order[tier] ?? []).filter(id => suggested.some(record => record.id === id))
    const initial = suggested.filter(record => {
      const level = byId.get(record.id)?.skill_level
      const startingTier = level === 'Low Inter' ? 'Low Intermediate' : TIERS.find(value => value === level) ?? 'Beginner'
      return startingTier === tier && !assigned.has(record.id)
    }).map(record => record.id)
    return { tier, ids: [...saved, ...initial] }
  })
  const canReorder = canEdit && !search.trim()
  function reorder(id: string, target: string) {
    if (!canReorder || id === target) return
    const destination = tiers.find(row => target === row.tier || row.ids.includes(target))
    if (!destination || !tiers.some(row => row.ids.includes(id))) return
    const nextBoard = Object.fromEntries(tiers.map(row => [row.tier, row.ids.filter(player => player !== id)]))
    const originalIndex = destination.ids.indexOf(target)
    const nextIds = nextBoard[destination.tier]
    nextIds.splice(originalIndex < 0 ? nextIds.length : originalIndex, 0, id)
    const next = { ...placements, [board]: nextBoard }
    setPlacements(next)
    try {
      localStorage.setItem('success-padel:ranking-tiers', JSON.stringify(next))
      setOrderMessage('Order saved on this device.')
    } catch {
      setOrderMessage('Order changed for this session.')
    }
  }
  const drag = useRankingDrag(reorder)
  const isLoading = loading || rankLoading
  return <section className="member-rankings">
    <nav className="member-rankings__navigation" aria-label="Players and rankings"><Link to={`/members${ownerToken ? `#owner=${encodeURIComponent(ownerToken)}` : ''}`}>Players</Link><span aria-current="page">Rankings</span></nav>
    <header className="member-rankings__header"><Trophy aria-hidden="true" /><div><p>SUCCESS PADEL</p><h1>PLAYER RANKINGS</h1></div><span>{isLoading ? '—' : suggested.length}</span></header>
    <div className="member-rankings__boards" role="group" aria-label="Ranking lists">{(['all', 'men', 'women'] as const).map(value => <button key={value} type="button" aria-pressed={board === value} disabled={Boolean(drag.dragging)} onClick={() => { setBoard(value); setSearch(''); setOrderMessage('') }}>{value === 'all' ? 'All' : value === 'men' ? 'Men' : 'Women'}</button>)}</div>
    <p>Scored games in the past two months. Rankings are provisional.</p>
    <div className="member-rankings__toolbar">
      <label className="member-rankings__search"><Search aria-hidden="true" /><input type="search" aria-label="Search ranked players" placeholder="Search players" value={search} onChange={e => setSearch(e.target.value)} /></label>
    </div>
    {error || rankError ? <div className="member-rankings__empty" role="alert">{error || rankError}{rankError ? <button type="button" onClick={() => void refresh()}>Retry</button> : null}</div> : isLoading ? <p role="status">Loading rankings…</p> : <>
      {tiers.map(({ tier, ids }, index) => (
        <section className="member-rankings__tier" key={tier} aria-label={tier} data-rank-id={tier} data-drop-target={drag.over === tier}>
          <h2>{tier}</h2>
          <div className="member-rankings__tiles">
            {ids.filter(id => byId.get(id)?.display_name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).map(id => {
              const member = byId.get(id)!
              const content = <>
                {member.avatar_url ? <img src={member.avatar_url} alt="" loading="lazy" draggable={false} /> : <span aria-hidden="true">{member.display_name.trim().slice(0, 1).toUpperCase()}</span>}
                <strong>{member.display_name}</strong>
              </>
              return <div className="member-rankings__tile" key={id} data-rank-id={id} data-dragging={drag.dragging === id} data-drop-target={drag.over === id && drag.dragging !== id}>
                {canEdit ? <button type="button" disabled={!canReorder} aria-label={`Move ${member.display_name}`} title="Drag to move. Use left and right to reorder, or up and down to change tier."
                  onPointerDown={event => drag.start(event, id)} onPointerMove={drag.move} onPointerUp={drag.end}
                  onPointerCancel={drag.cancel} onLostPointerCapture={drag.cancel} onKeyDown={event => {
                    const position = ids.indexOf(id)
                    const targets = { ArrowLeft: ids[position - 1], ArrowRight: ids[position + 1], ArrowUp: tiers[index - 1]?.tier, ArrowDown: tiers[index + 1]?.tier }
                    if (event.key === 'Escape') drag.cancel()
                    const target = targets[event.key as keyof typeof targets]
                    if (target) { event.preventDefault(); reorder(id, target) }
                  }}>{content}</button> : <div>{content}</div>}
              </div>
            })}
          </div>
        </section>
      ))}
    </>}
    {orderMessage ? <p role="status" className="member-rankings__feedback">{orderMessage}</p> : null}
  </section>
}
