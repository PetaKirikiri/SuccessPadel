import { useEffect, useState } from 'react'
import { IconCopy, IconExternal, IconPublish, IconShuffle } from './ButtonIcons'
import type { GameRound } from '../lib/americanoSchedule'
import { supabase } from '../lib/supabaseClient'
import { GameBoardPreview } from './GameBoardPreview'
import { usesAmericanoScoring } from '../lib/competitionPresets'
import {
  americanoScheduleFromSession,
  courtsNeeded,
  isValidCourtLayout,
} from '../lib/competitionLayout'
import { solveBalancedSchedule } from '../lib/balancedSchedule'
import { competitionPlayUrl } from '../lib/siteUrl'
import {
  buildStoredSchedule,
  nextScheduleSeed,
  planRankedSchedule,
  RANKED_SCHEDULE_VERSION,
  scheduleSeedFromSession,
  sortRosterByRank,
} from '../lib/rankedSchedule'
import type { CompetitionPlayer } from '../hooks/useCompetitions'
import type { GameSession } from '../lib/types'

type Props = {
  sessionId: string
  session: GameSession
  roster: CompetitionPlayer[]
  onRefresh: () => void
}

export function CompetitionSetupPanel({ sessionId, session, roster, onRefresh }: Props) {
  const [courtNames, setCourtNames] = useState<string[]>([])
  const [previewSeed, setPreviewSeed] = useState(() =>
    scheduleSeedFromSession(session.scoring_config),
  )
  const [previewGames, setPreviewGames] = useState<GameRound[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAmericano = usesAmericanoScoring(session)
  const layoutValid = isValidCourtLayout(roster.length)
  const neededCourts = courtsNeeded(roster.length)
  const { totalGames, gameMinutes } = americanoScheduleFromSession(session)
  const isLive = Boolean(session.competition_started_at)
  const canPublish = session.status === 'open' && !isLive
  const playUrl = competitionPlayUrl(sessionId)

  useEffect(() => {
    let active = true
    void (async () => {
      const { data } = await supabase.rpc('list_setup_courts')
      if (active && Array.isArray(data)) {
        setCourtNames(
          (data as { name: string; sort_order: number }[])
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((c) => c.name),
        )
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const computeMatchups = () => {
    if (!isAmericano || !layoutValid || courtNames.length === 0) return
    setError(null)
    const next = nextScheduleSeed(previewSeed, roster.length)
    setPreviewSeed(next)
    const ranked = sortRosterByRank(roster)
    setPreviewGames(
      planRankedSchedule(
        ranked,
        courtNames.slice(0, neededCourts),
        totalGames,
        next,
      ),
    )
  }

  const publish = async () => {
    if (!previewGames?.length) return
    setBusy(true)
    setError(null)
    try {
      const ranked = sortRosterByRank(roster)
      const schedule = buildStoredSchedule(
        ranked,
        solveBalancedSchedule(ranked.length, totalGames, previewSeed),
      )
      const nextConfig = {
        ...(session.scoring_config ?? {}),
        schedule_seed: previewSeed,
        schedule_version: RANKED_SCHEDULE_VERSION,
        schedule,
      }
      const { error: cfgErr } = await supabase.rpc('save_competition_scoring_config', {
        p_session_id: sessionId,
        p_scoring_config: nextConfig,
      })
      if (cfgErr) throw new Error(cfgErr.message)
      const { error: err } = await supabase.rpc('start_competition', { p_session_id: sessionId })
      if (err) throw new Error(err.message)
      await onRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not publish')
    }
    setBusy(false)
  }

  if (!isAmericano || !layoutValid) {
    return (
      <p className="text-xs text-brand-muted">
        Need a multiple of 4 players (Americano) to set up courts.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
        Courts &amp; match-ups
      </p>

      <button
        type="button"
        disabled={courtNames.length === 0 || busy}
        onClick={computeMatchups}
        className="brand-btn-outline w-full py-2.5 text-sm font-semibold"
      >
        <IconShuffle />
        Compute match-ups
      </button>

      {courtNames.length === 0 && (
        <p className="text-xs text-brand-muted">Loading courts…</p>
      )}

      {previewGames && previewGames.length > 0 && (
        <GameBoardPreview
          session={session}
          games={previewGames}
          eventStartsAt={session.starts_at ?? undefined}
          gameMinutes={gameMinutes}
        />
      )}

      {canPublish && (
        <button
          type="button"
          disabled={busy || !previewGames?.length}
          onClick={() => void publish()}
          className="brand-btn w-full py-3 text-base font-semibold"
        >
          <IconPublish />
          {busy ? 'Publishing…' : 'Publish'}
        </button>
      )}

      {isLive && (
        <div className="game-card space-y-2 px-3 py-3">
          <p className="text-sm font-medium text-brand-primary">Tonight&apos;s link</p>
          <p className="text-xs text-brand-muted">
            Send this to players. They only see games and the leaderboard — not the rest of the app.
          </p>
          <p className="break-all text-xs text-brand-accent">{playUrl}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(playUrl).then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                })
              }}
              className="brand-btn flex-1 py-2 text-sm"
            >
              <IconCopy />
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <a
              href={playUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="brand-btn-outline shrink-0 px-3 py-2 text-xs"
            >
              <IconExternal />
              {session.status === 'complete' ? 'Review scores' : 'Open game'}
            </a>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
