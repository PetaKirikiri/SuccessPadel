import { Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { playerNameMatches, memberGender, type DirectoryMember } from '../lib/memberDirectory'
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

const namedPlayerPrefix = 'ranking-name:'

function rankingPlayerFromId(id: string): DirectoryMember | null {
  const match = /^ranking-name:(all|men|women):(.+)$/u.exec(id)
  if (!match) return null
  return {
    id, display_name: match[2], avatar_url: null,
    gender: match[1] === 'men' ? 'male' : match[1] === 'women' ? 'female' : null,
    skill_level: null, history_levels: [], directory_hidden: false,
    has_line_account: false, court_member: null,
  }
}

const TIERS = ['Advanced', 'High Intermediate', 'Intermediate', 'Low Intermediate', 'Beginner'] as const

type Props = {
  members: DirectoryMember[]; ownerToken: string | null; loading: boolean; error: string | null
}

export function MemberRankings({ members, ownerToken, loading, error }: Props) {
  const [board, setBoard] = useState<RankingBoard>('all')
  const [ranks, setRanks] = useState<MatchRecord[]>([])
  const [rankLoading, setRankLoading] = useState(true)
  const [rankError, setRankError] = useState('')
  const [selectedMember, setSelectedMember] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState('')
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
  const [orderMessage, setOrderMessage] = useState('')
  const [revision, setRevision] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  type BoardState = { placements: typeof placements; addedMembers: string[]; hidden: string[] }
  type PendingSave = { next: BoardState; message: string }
  const pendingKey = 'success-padel:pending-tier-board'
  const pending = useRef<PendingSave | null>(null)
  const serverRevision = useRef<number | null>(null)
  const writeInProgress = useRef(false)
  const [conflict, setConflict] = useState(false)
  const [syncFailed, setSyncFailed] = useState(false)

  const showBoard = useCallback((next: BoardState) => {
    setPlacements(next.placements)
    setAddedMembers(next.addedMembers)
    setHidden(next.hidden)
  }, [])

  const rememberPending = useCallback(() => {
    try {
      if (pending.current) {
        localStorage.setItem(pendingKey, JSON.stringify({ ...pending.current, revision: serverRevision.current }))
      } else {
        localStorage.removeItem(pendingKey)
      }
    } catch { /* The in-memory draft remains available. */ }
  }, [pendingKey])

  const syncBoard = useCallback(async () => {
    if (serverRevision.current === null || writeInProgress.current || !pending.current) return
    writeInProgress.current = true
    setSaving(true)
    setSyncFailed(false)
    setOrderMessage('Syncing…')
    try {
      while (pending.current) {
        const savingNow: PendingSave = pending.current
        const { data, error }: { data: any; error: unknown } = await supabase.rpc('access_member_tier_board', {
          p_revision: serverRevision.current, p_board: savingNow.next,
        })
        if (error) throw error
        serverRevision.current = data.revision
        setRevision(data.revision)
        if (pending.current === savingNow) {
          pending.current = null
          setOrderMessage(savingNow.message)
        }
        rememberPending()
      }
    } catch {
      setSyncFailed(true)
      setOrderMessage('Kept on this device. Shared sync failed.')
    } finally {
      writeInProgress.current = false
      setSaving(false)
    }
  }, [rememberPending])

  const readGeneration = useRef(0)
  const loadShared = useCallback(async () => {
    if (pending.current || writeInProgress.current) return
    const generation = ++readGeneration.current
    const { data, error }: { data: any; error: unknown } = await supabase.rpc('access_member_tier_board', {})
    if (generation !== readGeneration.current || pending.current || writeInProgress.current) return
    if (error) {
      setOrderMessage('Could not load shared board. Reload to retry.')
      return
    }
    let draft: (PendingSave & { revision: number }) | null = null
    try { draft = JSON.parse(localStorage.getItem(pendingKey) ?? 'null') }
    catch { /* A damaged draft cannot be restored. */ }
    setRevision(data.revision)
    if (draft && draft.revision !== data.revision) {
      serverRevision.current = null
      setConflict(true)
      showBoard(draft.next)
      setOrderMessage('Local changes kept. The shared board changed on another device.')
      return
    }
    serverRevision.current = data.revision
    if (draft) {
      pending.current = { next: draft.next, message: draft.message }
      showBoard(draft.next)
      void syncBoard()
    } else {
      if (data.board) showBoard(data.board)
    }
  }, [pendingKey, showBoard, syncBoard])
  useEffect(() => {
    void loadShared()
    const refreshVisible = () => { if (!document.hidden) void loadShared() }
    const interval = window.setInterval(refreshVisible, 15000)
    window.addEventListener('focus', refreshVisible)
    return () => {
      window.clearInterval(interval)
      readGeneration.current++
      window.removeEventListener('focus', refreshVisible)
    }
  }, [loadShared])

  function saveShared(next: BoardState, message: string) {
    if (revision === null || adding) return
    readGeneration.current++
    showBoard(next)
    if (serverRevision.current === null) {
      try { localStorage.setItem(pendingKey, JSON.stringify({ next, message, revision: -1 })) }
      catch { /* The in-memory draft remains available. */ }
      return
    }
    pending.current = { next, message }
    rememberPending()
    void syncBoard()
  }
  function saveHidden(next: string[]) {
    setMenuPlayer(null)
    void saveShared({ placements, addedMembers, hidden: next }, 'Board saved.')
  }
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
  const manual = new Set(addedMembers)
  const boardMembers = [...members, ...addedMembers.flatMap(id => {
    const player = rankingPlayerFromId(id)
    return player ? [player] : []
  })]
  const eligible = boardMembers.filter(member => eligibleForRanking(member, board) || (manual.has(member.id) && isOnBoard(member)))
  const byId = new Map(eligible.map(member => [member.id, member]))
  const recentIds = new Set(ranks.map(record => record.id))
  const manualRecords = addedMembers.filter(id => manual.has(id) && !recentIds.has(id))
    .map(id => ({ id, games: 0, wins: 0, draws: 0 }))
  const suggested = [...ranks, ...manualRecords].filter(record => byId.has(record.id) && !hidden.includes(record.id))
    .sort((a, b) => Number(b.games > 0) - Number(a.games > 0) || startingScore(b) - startingScore(a) || b.games - a.games || a.id.localeCompare(b.id))
  const visibleIds = new Set(suggested.map(record => record.id))
  const matchingMembers = selectedMember.trim()
    ? boardMembers.filter(member => playerNameMatches(member.display_name, selectedMember))
    : []
  const [addedTile, setAddedTile] = useState('')
  useEffect(() => {
    if (!addedTile) return
    document.querySelector(`.member-rankings__tile[data-rank-id="${CSS.escape(addedTile)}"]`)
      ?.scrollIntoView({ block: 'nearest' })
    setAddedTile('')
  }, [addedTile])

  async function addMember() {
    const name = selectedMember.trim().replace(/\s+/g, ' ')
    if (!name) {
      setOrderMessage('Type a player name first.')
      return
    }
    if (writeInProgress.current) {
      setOrderMessage('Another rankings change is saving. Try again in a moment.')
      return
    }
    const exact = matchingMembers.filter(candidate => candidate.display_name.toLowerCase() === name.toLowerCase())
    const selected = matchingMembers.find(candidate => candidate.id === selectedMemberId)
    const existing = selected ?? (exact.length === 1 ? exact[0] : undefined)
    if (!existing && matchingMembers.length) {
      setOrderMessage('Choose a matching player from the list.')
      return
    }
    const member = existing ?? { id: `${namedPlayerPrefix}${board}:${name}`, display_name: name }
    if (visibleIds.has(member.id)) {
      setOrderMessage(`${member.display_name} is already on this board.`)
      setAddedTile(member.id)
      return
    }
    const addTo = (state: BoardState): BoardState => ({
      ...state,
      addedMembers: [...new Set([...state.addedMembers, member.id])],
      hidden: state.hidden.filter(id => id !== member.id),
    })
    const localBoard = { placements, addedMembers, hidden }
    writeInProgress.current = true
    readGeneration.current++
    setAdding(true)
    setOrderMessage(`Adding ${member.display_name}…`)
    try {
      // Merge only this member into the latest shared board. A concurrent
      // reorder can advance the revision between the read and write.
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: latest, error: readError } = await supabase.rpc('access_member_tier_board', {})
        if (readError || !latest) throw readError ?? new Error('Shared board unavailable')
        const next = addTo(latest.board ?? { placements: {}, addedMembers: [], hidden: [] })
        const { data, error: writeError } = await supabase.rpc('access_member_tier_board', {
          p_revision: latest.revision,
          p_board: next,
        })
        if (writeError?.message.includes('changed on another device') && attempt < 2) continue
        if (writeError || !data) throw writeError ?? new Error('Shared board unavailable')

        if (pending.current || conflict) {
          // A failed reorder is a separate draft. Keep its original revision
          // so it cannot overwrite newer shared changes.
          if (pending.current) {
            pending.current = { ...pending.current, next: addTo(pending.current.next) }
            rememberPending()
          }
          if (conflict) {
            try {
              const draft = JSON.parse(localStorage.getItem(pendingKey) ?? 'null')
              if (draft) localStorage.setItem(pendingKey, JSON.stringify({ ...draft, next: addTo(draft.next) }))
            } catch { /* The shared addition has already been saved. */ }
          }
          showBoard(addTo(localBoard))
        } else {
          serverRevision.current = data.revision
          setRevision(data.revision)
          showBoard(data.board ?? next)
        }
        if (existing && !isOnBoard(existing)) setBoard('all')
        setSelectedMember('')
        setSelectedMemberId('')
        setOrderMessage(`${member.display_name} added to rankings.`)
        setAddedTile(member.id)
        return
      }
    } catch (error) {
      const reason = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message
        : 'The shared board did not respond.'
      setOrderMessage(`Could not add ${member.display_name}. ${reason}`)
    } finally {
      writeInProgress.current = false
      setAdding(false)
    }
  }
  const order = placements[board] ?? {}
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
  const canReorder = revision !== null && serverRevision.current !== null && !adding
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
    void saveShared({ placements: next, addedMembers, hidden }, `${byId.get(id)?.display_name ?? 'Player'} moved to ${destination.tier}. Board saved.`)
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
    <div className="member-rankings__toolbar">
      <div className="member-rankings__boards" role="group" aria-label="Ranking lists">{(['all', 'men', 'women'] as const).map(value => <button key={value} type="button" aria-pressed={board === value} disabled={adding || Boolean(drag.dragging)} onClick={() => { setBoard(value); setSelectedMember(''); setSelectedMemberId(''); setOrderMessage('') }}>{value === 'all' ? 'All' : value === 'men' ? 'Men' : 'Women'}</button>)}</div>
      {revision === 0 && (Object.keys(placements).length > 0 || hidden.length > 0 || addedMembers.length > 0)
        ? <button type="button" disabled={saving || adding} onClick={() => void saveShared({ placements, addedMembers, hidden }, 'Board saved across devices.')}>Save this browser’s board</button> : null}
      {hidden.length > 0 ? <button type="button" disabled={!canReorder} onClick={() => saveHidden([])}>Restore hidden ({hidden.length})</button> : null}
      <form className="member-rankings__add" onSubmit={event => { event.preventDefault(); void addMember() }}>
        <input type="text" aria-label="Player name" placeholder="Search or type player name"
          value={selectedMember} maxLength={80} disabled={adding}
          onChange={event => { setSelectedMember(event.target.value); setSelectedMemberId('') }} />
        {matchingMembers.length > 0 && (
          <select aria-label="Matching players" value={selectedMemberId} disabled={adding}
            onChange={event => setSelectedMemberId(event.target.value)}>
            <option value="">Choose matching player</option>
            {matchingMembers.map(member => <option key={member.id} value={member.id}>{member.display_name}</option>)}
          </select>
        )}
        <button type="submit" disabled={adding}>{adding ? 'Adding…' : 'Add player'}</button>
      </form>
    </div>
    {orderMessage ? <p role="status" className="member-rankings__feedback">{orderMessage}</p> : null}
    {conflict || syncFailed ? <button type="button" disabled={saving || adding} onClick={() => {
      try {
        const draft = localStorage.getItem(pendingKey)
        if (draft) localStorage.setItem(pendingKey + ':backup', draft)
        localStorage.removeItem(pendingKey)
      } catch { setOrderMessage('Could not back up your local changes.'); return }
      pending.current = null
      setConflict(false)
      setSyncFailed(false)
      void loadShared()
    }}>Use shared board</button> : null}
    {syncFailed ? <button type="button" disabled={adding} onClick={() => void syncBoard()}>Retry sync</button> : null}
    {rankError && <div className="member-rankings__empty" role="alert">{rankError}<button type="button" onClick={() => void refresh()}>Retry</button></div>}
    {error && <div className="member-rankings__empty" role="alert">{error}</div>}
    {isLoading && <p role="status">Loading rankings…</p>}
    {tiers.map(({ tier, ids }, index) => (
        <section className="member-rankings__tier" key={tier} aria-label={tier} data-rank-id={tier} data-drop-at-end={drag.over === tier} data-drop-target={drag.over === tier || Boolean(drag.over && ids.includes(drag.over) && drag.over !== drag.dragging)}>
          <h2>{tier}</h2>
          <div className="member-rankings__tiles">
            {ids.map(id => {
              const member = byId.get(id)!
              const content = <>
                {member.avatar_url ? <img src={member.avatar_url} alt="" loading="lazy" draggable={false} /> : <span aria-hidden="true">{member.display_name.trim().slice(0, 1).toUpperCase()}</span>}
                <strong>{member.display_name}</strong>
              </>
              return <div className="member-rankings__tile" key={id} data-rank-id={id} data-dragging={drag.dragging === id} data-insert={drag.over === id && drag.dragging !== id ? (drag.after ? 'after' : 'before') : undefined}>
                {canReorder ? <button type="button" disabled={!canReorder} aria-label={`Move ${member.display_name}`}
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
                {menuPlayer === id ? <div className="member-rankings__tile-menu">
                  <button type="button" autoFocus onClick={() => saveHidden([...hidden, id])}>Remove from board</button>
                </div> : null}
              </div>
            })}
          </div>
        </section>
    ))}

  </section>
}
