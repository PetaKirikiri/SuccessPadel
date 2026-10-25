import { GripVertical, Plus, Search, Trophy } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { type DirectoryMember, type DirectoryPatch } from '../lib/memberDirectory'
import { eligibleForRanking, type RankingBoard } from '../lib/memberRankingBoard'
import { supabase } from '../lib/supabaseClient'
import { MemberDirectoryCard } from './PublicMemberDirectory'
import { useRankingDrag } from './useRankingDrag'
import '../layouts/member-rankings.layout.css'
import '../layouts/members.layout.css'

export type Rank = { id: string; position: number }
export type RankingApi = {
  list: (token: string | null, board: RankingBoard) => Promise<Rank[]>
  move: (id: string, position: number | null, token: string | null, board: RankingBoard) => Promise<Rank[]>
}
const rankingApi: RankingApi = {
  async list(token, board) {
    const result = await supabase.rpc('list_member_ranking_board', { p_board: board, p_access_token: token })
    if (result.error) throw new Error(result.error.message)
    return (result.data as Rank[] | null) ?? []
  },
  async move(id, position, token, board) {
    const result = await supabase.rpc('set_member_board_rank', { p_board: board, p_member_id: id, p_position: position, p_access_token: token })
    if (result.error) throw new Error(result.error.message)
    return (result.data as Rank[] | null) ?? []
  },
}
type Props = {
  api?: RankingApi; members: DirectoryMember[]; canEdit: boolean; ownerToken: string | null; loading: boolean; error: string | null
  onSave?: (id: string, patch: DirectoryPatch) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onUploadPhoto?: (id: string, file: File) => Promise<string>
}
export function MemberRankings({ members, canEdit, ownerToken, loading, error, onSave, onDelete, onUploadPhoto, api = rankingApi }: Props) {
  const [board, setBoard] = useState<RankingBoard>('all')
  const [ranks, setRanks] = useState<Rank[]>([])
  const [rankLoading, setRankLoading] = useState(true)
  const [rankError, setRankError] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState('')
  const [feedback, setFeedback] = useState('')
  const request = useRef(0)
  const saving = useRef(false)
  const refresh = useCallback(async () => {
    const sequence = ++request.current
    setRankLoading(true); setRankError('')
    try { const result = await api.list(canEdit ? ownerToken : null, board); if (sequence === request.current) setRanks(result) }
    catch { if (sequence === request.current) { setRankError('Could not load rankings.'); setRanks([]) } }
    finally { if (sequence === request.current) setRankLoading(false) }
  }, [canEdit, ownerToken, api, board])
  useEffect(() => { void refresh(); return () => { request.current++ } }, [refresh])
  const eligible = members.filter(m => eligibleForRanking(m, board))
  const byId = new Map(eligible.map(m => [m.id, m]))
  const homeRanks = ranks.filter(r => byId.has(r.id)).map((r, i) => ({ ...r, position: i + 1 }))
  const rankedIds = new Set(homeRanks.map(r => r.id))
  const unranked = eligible.filter(m => !rankedIds.has(m.id))
  const rows = homeRanks.flatMap(rank => { const member = byId.get(rank.id); return member ? [{ ...rank, member }] : [] })
    .filter(({ member }) => member.display_name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  const isLoading = loading || rankLoading
  async function move(id: string, position: number) {
    if (saving.current || !canEdit || !byId.has(id)) return
    saving.current = true; setBusy(true); setFeedback('Saving…')
    try {
      const result = await api.move(id, position, ownerToken, board)
      setRanks(result); setSelected(''); setFeedback(`${byId.get(id)?.display_name ?? 'Player'} moved to #${position}`)
    } catch (e) { setFeedback(e instanceof Error ? e.message : 'Could not save ranking. Try again.') }
    finally { saving.current = false; setBusy(false) }
  }
  const drag = useRankingDrag((id, target) => {
    const rank = homeRanks.find(r => r.id === target)
    if (rank) void move(id, rank.position)
  })
  const canDrag = canEdit && !busy && !isLoading && !rankError && !error && !search.trim()
  // The parent merges the saved member into the existing list. Eligibility is
  // derived above, so edits must not reload ranks and unmount every card.
  return <section className="member-rankings">
    <nav className="member-rankings__navigation" aria-label="Players and rankings"><Link to={`/members${ownerToken ? `#owner=${encodeURIComponent(ownerToken)}` : ''}`}>Players</Link><span aria-current="page">Rankings</span></nav>
    <header className="member-rankings__header"><Trophy aria-hidden="true" /><div><p>SUCCESS PADEL</p><h1>PLAYER RANKINGS</h1></div><span>{isLoading ? '—' : homeRanks.length}</span></header>
    <div className="member-rankings__boards" role="group" aria-label="Ranking lists">{(['all', 'men', 'women'] as const).map(value => <button key={value} type="button" aria-pressed={board === value} disabled={busy || Boolean(drag.dragging)} onClick={() => { if (value !== board) { setRankLoading(true); setRanks([]); setBoard(value); setSelected(''); setFeedback(''); setSearch('') } }}>{value === 'all' ? 'All' : value === 'men' ? 'Men' : 'Women'}</button>)}</div>
    <div className="member-rankings__toolbar">
      <label className="member-rankings__search"><Search aria-hidden="true" /><input type="search" aria-label="Search ranked players" placeholder="Search players" value={search} onChange={e => setSearch(e.target.value)} /></label>
      {canEdit && unranked.length > 0 ? <div className="member-rankings__add">
        <select aria-label="Player to add to rankings" value={selected} disabled={busy || isLoading || Boolean(rankError || error)} onChange={e => setSelected(e.target.value)}><option value="">Add player</option>{unranked.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}</select>
        <button type="button" aria-label="Add player to rankings" disabled={!unranked.some(m => m.id === selected) || busy || isLoading || Boolean(rankError || error)} onClick={() => void move(selected, homeRanks.length + 1)}><Plus aria-hidden="true" /></button>
      </div> : null}
    </div>
    {error || rankError ? <div className="member-rankings__empty" role="alert">{error || rankError}{rankError ? <button type="button" onClick={() => void refresh()}>Retry</button> : null}</div> : isLoading ? <p role="status">Loading rankings…</p> : <>
      <ol className="member-rankings__list">{rows.map(({ id, position, member }) => <li className="member-rankings__card-row" key={id} data-rank-id={id} data-dragging={drag.dragging === id} data-drop-target={drag.over === id && drag.dragging !== id}>
        <div className="member-rankings__rank-handle">
          <strong className="member-rankings__position" aria-label={`Rank ${position}`}>{position}</strong>
          {canEdit ? <button className="member-rankings__drag" type="button" disabled={!canDrag} aria-label={`Reorder ${member.display_name}`} title={search.trim() ? 'Clear search to reorder' : 'Drag to reorder, or use arrow keys'} onPointerDown={e => drag.start(e, id)} onPointerMove={drag.move} onPointerUp={drag.end} onPointerCancel={drag.cancel} onLostPointerCapture={drag.cancel} onKeyDown={e => {
            if (e.key === 'Escape') drag.cancel()
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const next = position + (e.key === 'ArrowUp' ? -1 : 1); if (next >= 1 && next <= homeRanks.length) void move(id, next) }
          }}><GripVertical aria-hidden="true" /></button> : null}
        </div>
        <div className="member-directory__card" data-editable={canEdit}><MemberDirectoryCard member={member} canEdit={canEdit} onSave={onSave} onDelete={onDelete} onUploadPhoto={onUploadPhoto} /></div>
      </li>)}</ol>
      {!rows.length ? <p className="member-rankings__empty">{search.trim() ? 'No matching players.' : 'No ranked home players yet.'}</p> : null}
    </>}
    {feedback ? <p role="status" className="member-rankings__feedback">{feedback}</p> : null}
  </section>
}
