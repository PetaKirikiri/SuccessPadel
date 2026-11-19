import { Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { memberGender, type DirectoryMember } from '../lib/memberDirectory'
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
  const [selectedMember, setSelectedMember] = useState('')
  const [addedMembers, setAddedMembers] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('success-padel:added-tier-members') ?? '[]')
      return Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : []
    } catch { return [] }
  })
  const [placements, setPlacements] = useState<Partial<Record<RankingBoard, Record<string, string[]>>>>(() => {
    try { return JSON.parse(localStorage.getItem('success-padel:ranking-tiers') ?? '{}') ?? {} }
    catch { return {} }
  })
  const [hidden, setHidden] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('success-padel:hidden-tier-players') ?? '[]')
      return Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : []
    } catch { return [] }
  })
  const [menuPlayer, setMenuPlayer] = useState<string | null>(null)
  function saveHidden(next: string[]) {
    setHidden(next)
    setMenuPlayer(null)
    try { localStorage.setItem('success-padel:hidden-tier-players', JSON.stringify(next)) }
    catch { /* The current page still reflects the change. */ }
  }
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
  const isOnBoard = (member: DirectoryMember) =>
    board === 'all' || memberGender(member.gender) === (board === 'men' ? 'Men' : 'Women')
  const manual = new Set(canEdit ? addedMembers : [])
  const eligible = members.filter(member => eligibleForRanking(member, board) || (manual.has(member.id) && isOnBoard(member)))
  const byId = new Map(eligible.map(member => [member.id, member]))
  const recentIds = new Set(ranks.map(record => record.id))
  const manualRecords = addedMembers.filter(id => manual.has(id) && !recentIds.has(id))
    .map(id => ({ id, games: 0, wins: 0, draws: 0 }))
  const suggested = [...ranks, ...manualRecords].filter(record => byId.has(record.id) && !(canEdit && hidden.includes(record.id)))
    .sort((a, b) => Number(b.games > 0) - Number(a.games > 0) || startingScore(b) - startingScore(a) || b.games - a.games || a.id.localeCompare(b.id))
  const visibleIds = new Set(suggested.map(record => record.id))
  const available = members.filter(member => isOnBoard(member) && !visibleIds.has(member.id))
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
  function addMember() {
    const member = available.find(candidate => candidate.id === selectedMember)
    if (!canEdit || !member) return
    const next = [...new Set([...addedMembers, member.id])]
    setAddedMembers(next)
    saveHidden(hidden.filter(id => id !== member.id))
    setSelectedMember('')
    try {
      localStorage.setItem('success-padel:added-tier-members', JSON.stringify(next))
      setOrderMessage(`${member.display_name} added on this device.`)
    } catch {
      setOrderMessage(`${member.display_name} added for this session.`)
    }
  }
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
  const canReorder = canEdit
  function reorder(id: string, target: string, after = false) {
    if (!canReorder || id === target) return
    const destination = tiers.find(row => target === row.tier || row.ids.includes(target))
    if (!destination || !tiers.some(row => row.ids.includes(id))) return
    const nextBoard = Object.fromEntries(tiers.map(row => [row.tier, row.ids.filter(player => player !== id)]))
    const originalIndex = nextBoard[destination.tier].indexOf(target)
    const nextIds = nextBoard[destination.tier]
    nextIds.splice(originalIndex < 0 ? nextIds.length : originalIndex + Number(after), 0, id)
    if (tiers.every(row => row.ids.join(',') === nextBoard[row.tier].join(','))) return
    for (const tier of TIERS) {
      nextBoard[tier].push(...(order[tier] ?? []).filter(player => !visibleIds.has(player)))
    }
    const next = { ...placements, [board]: nextBoard }
    setPlacements(next)
    try {
      localStorage.setItem('success-padel:ranking-tiers', JSON.stringify(next))
      setOrderMessage(`${byId.get(id)?.display_name ?? 'Player'} moved to ${destination.tier} · saved on this device.`)
    } catch {
      setOrderMessage('Order changed for this session.')
    }
  }
  const drag = useRankingDrag(reorder)
  const isLoading = loading || rankLoading
  useEffect(() => {
    if (!menuPlayer) return
    const dismiss = () => setMenuPlayer(null)
    window.addEventListener('click', dismiss)
    return () => window.removeEventListener('click', dismiss)
  }, [menuPlayer])
  return <section className="member-rankings" onKeyDown={event => {
    if (event.key === 'Escape') setMenuPlayer(null)
  }}>
    <nav className="member-rankings__navigation" aria-label="Players and rankings"><Link to={`/members${ownerToken ? `#owner=${encodeURIComponent(ownerToken)}` : ''}`}>Players</Link><span aria-current="page">Rankings</span></nav>
    <header className="member-rankings__header"><Trophy aria-hidden="true" /><div><h1>PLAYER RANKINGS</h1></div><span>{isLoading ? '—' : suggested.length}</span></header>
    <div className="member-rankings__boards" role="group" aria-label="Ranking lists">{(['all', 'men', 'women'] as const).map(value => <button key={value} type="button" aria-pressed={board === value} disabled={Boolean(drag.dragging)} onClick={() => { setBoard(value); setSelectedMember(''); setOrderMessage('') }}>{value === 'all' ? 'All' : value === 'men' ? 'Men' : 'Women'}</button>)}</div>
    <div className="member-rankings__toolbar">
      {canEdit && hidden.length > 0 ? <button type="button" onClick={() => saveHidden([])}>Restore hidden players ({hidden.length})</button> : null}
      {canEdit ? <div className="member-rankings__add">
        <select aria-label="Existing member to add" value={selectedMember} disabled={isLoading}
          onChange={event => setSelectedMember(event.target.value)}>
          <option value="">Choose an existing member</option>
          {available.map(member => <option key={member.id} value={member.id}>{member.display_name}</option>)}
        </select>
        <button type="button" onClick={addMember} disabled={isLoading || !selectedMember}>Add member</button>
      </div> : null}
    </div>
    {error || rankError ? <div className="member-rankings__empty" role="alert">{error || rankError}{rankError ? <button type="button" onClick={() => void refresh()}>Retry</button> : null}</div> : isLoading ? <p role="status">Loading rankings…</p> : <>
      {tiers.map(({ tier, ids }, index) => (
        <section className="member-rankings__tier" key={tier} aria-label={tier} data-rank-id={tier} data-drop-target={drag.over === tier || Boolean(drag.over && ids.includes(drag.over) && drag.over !== drag.dragging)}>
          <h2>{tier}</h2>
          <div className="member-rankings__tiles">
            {ids.map(id => {
              const member = byId.get(id)!
              const content = <>
                {member.avatar_url ? <img src={member.avatar_url} alt="" loading="lazy" draggable={false} /> : <span aria-hidden="true">{member.display_name.trim().slice(0, 1).toUpperCase()}</span>}
                <strong>{member.display_name}</strong>
              </>
              return <div className="member-rankings__tile" key={id} data-rank-id={id} data-dragging={drag.dragging === id} data-insert={drag.over === id && drag.dragging !== id ? (drag.after ? 'after' : 'before') : undefined}>
                {canEdit ? <button type="button" disabled={!canReorder} aria-label={`Move ${member.display_name}`}
                  onContextMenu={event => { event.preventDefault(); drag.cancel(); setMenuPlayer(id) }}
                  onPointerDown={event => drag.start(event, id)} onPointerMove={drag.move} onPointerUp={drag.end}
                  onPointerCancel={drag.cancel} onLostPointerCapture={drag.cancel} onKeyDown={event => {
                    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                      event.preventDefault()
                      setMenuPlayer(id)
                      return
                    }
                    const position = ids.indexOf(id)
                    const targets = { ArrowLeft: ids[position - 1], ArrowRight: ids[position + 1], ArrowUp: tiers[index - 1]?.tier, ArrowDown: tiers[index + 1]?.tier }
                    if (event.key === 'Escape') drag.cancel()
                    const target = targets[event.key as keyof typeof targets]
                    if (target) { event.preventDefault(); reorder(id, target, event.key === 'ArrowRight') }
                  }}>{content}</button> : <div>{content}</div>}
                {canEdit && menuPlayer === id ? <div className="member-rankings__tile-menu">
                  <button type="button" autoFocus onClick={() => saveHidden([...hidden, id])}>Remove from board</button>
                </div> : null}
              </div>
            })}
          </div>
        </section>
      ))}
    </>}
    {orderMessage ? <p role="status" className="member-rankings__feedback">{orderMessage}</p> : null}
  </section>
}
