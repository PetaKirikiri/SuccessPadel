import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CompetitionStandings } from '../../lib/competition-formats/contract'
import { validateStandings } from '../../lib/competition-formats/contract'
import type { LeaderboardEntry } from '../../lib/leaderboardTypes'
import { standingsDisplayRank } from '../../lib/competitionAchievements'
import { PlayerAvatar } from '../../shared/ProfilePhoto/PlayerAvatar'

export function CompetitionReviewPlayerTiles({ standings, selectedId, onSelect, unit }: {
  standings: CompetitionStandings; selectedId?: string; onSelect: (entry: LeaderboardEntry) => void; unit: string
}) {
  const selectedIndex = standings.entries.findIndex(entry => entry.profile_id === selectedId)
  const [page, setPage] = useState(() => Math.floor(Math.max(0, selectedIndex) / 4))
  useEffect(() => { setPage(Math.floor(Math.max(0, selectedIndex) / 4)) }, [selectedIndex])
  if (standings.error || !validateStandings(standings.format, standings.entries)) return <p role="status">{standings.error ?? 'Results are not available yet.'}</p>
  const pages = Math.max(1, Math.ceil(standings.entries.length / 4))
  const currentPage = Math.min(page, pages - 1)
  return <>
    <ol className="competition-review__player-tiles" aria-label={standings.format === 'duos' ? 'Team standings' : 'Player standings'}>
      {standings.entries.slice(currentPage * 4, currentPage * 4 + 4).map((entry, index) => <li key={entry.profile_id}>
        <button type="button" aria-pressed={entry.profile_id === selectedId} onClick={() => onSelect(entry)}>
          <span className="competition-review__tile-rank">#{standingsDisplayRank(standings.entries, currentPage * 4 + index)}</span>
          <PlayerAvatar displayName={entry.display_name} avatarUrl={entry.avatar_url} imgClassName="competition-review__tile-avatar" />
          <strong className="competition-review__tile-name">{entry.display_name}</strong>
          <span className="competition-review__tile-score"><b>{entry.total_points}</b> {unit}</span>
        </button>
      </li>)}
    </ol>
    {pages > 1 ? <nav className="competition-review__player-pages" aria-label="Browse review players">
      <button type="button" aria-label="Previous players" disabled={currentPage === 0} onClick={() => setPage(value => Math.max(0, value - 1))}><ChevronLeft aria-hidden="true" /></button>
      <span>{currentPage + 1} / {pages}</span>
      <button type="button" aria-label="Next players" disabled={currentPage === pages - 1} onClick={() => setPage(value => Math.min(pages - 1, value + 1))}><ChevronRight aria-hidden="true" /></button>
    </nav> : null}
  </>
}
