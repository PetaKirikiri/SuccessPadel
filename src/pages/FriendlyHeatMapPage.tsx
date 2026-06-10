import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFriendlyGame } from '../hooks/useFriendlyGame'
import { useMatchGestureLog } from '../hooks/useMatchGestureLog'
import { useCourtLive } from '../hooks/useCourtLive'
import { friendlyQuadrantPlayers, isFreeFriendly } from '../lib/friendlyGames'
import { COURT_QUADRANTS } from '../lib/courtPositionSetup'
import { teamHalfFromQuadrant } from '../lib/courtHalfCapture'
import type { Quadrant } from '../lib/gestureCapture'
import {
  buildDepthZones,
  buildHeatMapDots,
  buildMatchGames,
  buildPlayerInsights,
  buildServeStats,
  computeMatchStats,
  SHOT_KINDS,
  SHOT_KIND_COLOR,
  type ShotKind,
} from '../lib/heatMapStats'
import { HeatMapCourt } from '../components/HeatMapCourt'
import { HeatMapInsightCards } from '../components/HeatMapInsightCards'
import { HeatMapPlayerChips } from '../components/HeatMapPlayerChips'
import { HeatMapStatPanels } from '../components/HeatMapStatPanels'
import { LanguagePicker } from '../components/LanguagePicker'
import { useTranslation } from '../hooks/useTranslation'

type OutcomeFilter = 'all' | 'score' | 'foul'

const KIND_KEY: Record<ShotKind, string> = {
  smash: 'stats.kindSmash',
  forehand: 'stats.kindForehand',
  backhand: 'stats.kindBackhand',
  volley: 'stats.kindVolley',
  lob: 'stats.kindLob',
}

const OUTCOME_KEY: Record<OutcomeFilter, string> = {
  all: 'stats.filterAll',
  score: 'stats.filterScore',
  foul: 'stats.filterFoul',
}

export function FriendlyHeatMapPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, profile, loading } = useAuth()
  const { game, loading: gameLoading } = useFriendlyGame(id)
  const { log, loading: logLoading, refresh } = useMatchGestureLog(id, {
    friendlySessionFallback: true,
  })

  useCourtLive(id, { onCommitted: () => void refresh() })

  const [selected, setSelected] = useState<Quadrant | null>(null)
  const [activeKinds, setActiveKinds] = useState<Set<ShotKind>>(new Set(SHOT_KINDS))
  const [outcome, setOutcome] = useState<OutcomeFilter>('all')
  const [selectedGame, setSelectedGame] = useState<number | 'all'>('all')
  const [shareNote, setShareNote] = useState<string | null>(null)

  const players = useMemo(() => (game ? friendlyQuadrantPlayers(game) : {}), [game])

  useEffect(() => {
    if (selected) return
    const first = COURT_QUADRANTS.find((q) => players[q]?.name?.trim())
    if (first) setSelected(first)
  }, [players, selected])

  const activeQuadrant = selected ?? COURT_QUADRANTS.find((q) => players[q]?.name?.trim()) ?? 'TL'

  const gameInfo = useMemo(() => buildMatchGames(log?.pointEvents ?? []), [log])

  const gestures = useMemo(() => {
    const all = log?.gestures ?? []
    if (selectedGame === 'all') return all
    return all.filter((g) => gameInfo.gameOfGesture(g) === selectedGame)
  }, [log, gameInfo, selectedGame])

  const pointEvents = useMemo(() => {
    const all = log?.pointEvents ?? []
    if (selectedGame === 'all') return all
    return all.filter((_, i) => gameInfo.pointGames[i] === selectedGame)
  }, [log, gameInfo, selectedGame])

  const dots = useMemo(() => {
    const all = buildHeatMapDots(gestures, activeQuadrant)
    return all.filter(
      (d) =>
        (d.kind ? activeKinds.has(d.kind) : true) &&
        (outcome === 'all' || d.outcome === outcome),
    )
  }, [gestures, activeQuadrant, activeKinds, outcome])

  const zones = useMemo(
    () => buildDepthZones(gestures, activeQuadrant),
    [gestures, activeQuadrant],
  )
  const serve = useMemo(
    () => buildServeStats(pointEvents, activeQuadrant),
    [pointEvents, activeQuadrant],
  )
  const stats = useMemo(
    () => computeMatchStats(gestures, activeQuadrant),
    [gestures, activeQuadrant],
  )
  const insights = useMemo(
    () => buildPlayerInsights(gestures, activeQuadrant, stats, t),
    [gestures, activeQuadrant, stats, t],
  )

  if (loading || gameLoading || (user && !profile)) {
    return <p className="p-4 text-center text-sm text-brand-muted">{t('common.loading')}</p>
  }
  if (!user || !profile?.is_admin || !game) {
    return <Navigate to="/friendly" replace />
  }

  const handleShare = async () => {
    const url = window.location.href
    const shareData = { title: `${t('stats.title')} — ${game.title}`, url }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch {
        return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setShareNote(t('stats.linkCopied'))
      setTimeout(() => setShareNote(null), 2000)
    } catch {
      setShareNote(t('stats.copyFailed'))
      setTimeout(() => setShareNote(null), 2000)
    }
  }

  const toggleKind = (kind: ShotKind) => {
    setActiveKinds((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  return (
    <div
      className="fixed inset-0 z-[400] flex flex-col overflow-hidden bg-[#0b2a4a] text-white"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-white/15 px-4 py-3">
        <button
          type="button"
          onClick={() => navigate(isFreeFriendly(game) ? `/friendly/${game.id}/pad` : `/friendly/${game.id}`)}
          className="shrink-0 rounded-full border border-white/35 bg-black/40 px-3 py-1.5 text-sm font-semibold hover:bg-white/10"
        >
          {t('common.back').replace(/^←\s*/, '')}
        </button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{t('stats.title')}</h1>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <LanguagePicker dark />
          <button
            type="button"
            onClick={handleShare}
            aria-label={t('stats.share')}
            title={shareNote ?? t('stats.share')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/35 bg-black/40 text-white hover:bg-white/10"
          >
            {shareNote ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden
              >
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <div className="shrink-0 border-b border-white/10 px-4 py-3">
        <HeatMapPlayerChips players={players} selected={activeQuadrant} onSelect={setSelected} />
      </div>

      {gameInfo.count > 1 ? (
        <div className="shrink-0 border-b border-white/10 px-4 py-2">
          <div className="flex flex-wrap gap-1.5">
            {(['all', ...Array.from({ length: gameInfo.count }, (_, i) => i)] as (
              | 'all'
              | number
            )[]).map(
              (value) => {
                const active = selectedGame === value
                return (
                  <button
                    key={String(value)}
                    type="button"
                    onClick={() => setSelectedGame(value)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-white bg-white text-[#11355c]'
                        : 'border-white/30 bg-black/30 text-white hover:bg-white/10'
                    }`}
                  >
                    {value === 'all' ? t('stats.allGames') : t('stats.game', { n: value + 1 })}
                  </button>
                )
              },
            )}
          </div>
        </div>
      ) : null}

      {logLoading ? (
        <p className="p-6 text-center text-sm text-white/70">{t('stats.loadingData')}</p>
      ) : !log ? (
        <p className="p-6 text-center text-sm text-white/70">{t('stats.noData')}</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <HeatMapInsightCards cards={insights} />
          <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          <div className="lg:w-[22rem] lg:shrink-0">
            <HeatMapStatPanels stats={stats} serve={serve} zones={zones} />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {SHOT_KINDS.map((kind) => {
                const active = activeKinds.has(kind)
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => toggleKind(kind)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-opacity ${
                      active ? 'border-white/40 bg-white/10' : 'border-white/15 bg-transparent opacity-40'
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: SHOT_KIND_COLOR[kind] }}
                    />
                    {t(KIND_KEY[kind])}
                  </button>
                )
              })}
              <div className="ml-auto flex overflow-hidden rounded-full border border-white/25 text-xs font-semibold">
                {(['all', 'score', 'foul'] as OutcomeFilter[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setOutcome(value)}
                    className={`px-3 py-1 ${
                      outcome === value ? 'bg-white text-[#11355c]' : 'bg-black/30 text-white'
                    }`}
                  >
                    {t(OUTCOME_KEY[value])}
                  </button>
                ))}
              </div>
            </div>

            <div className="mx-auto h-[62vh] w-full max-w-[22rem] flex-1 lg:h-auto">
              <HeatMapCourt dots={dots} zones={zones} half={teamHalfFromQuadrant(activeQuadrant)} />
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  )
}
