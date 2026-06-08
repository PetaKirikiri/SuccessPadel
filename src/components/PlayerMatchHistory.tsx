import { useEffect, useState } from 'react'
import { useTranslation } from '../hooks/useTranslation'
import { useLocale } from '../providers/LocaleProvider'
import { fetchPlayerMatchHistory, type PlayerMatchHistoryEntry } from '../lib/playerMatchHistory'

type Props = {
  playerId: string
  embedded?: boolean
}

function formatPlayedAt(iso: string | null, locale: string): string {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(
      new Date(iso),
    )
  } catch {
    return iso.slice(0, 10)
  }
}

function MatchRow({
  entry,
  locale,
  t,
  embedded,
}: {
  entry: PlayerMatchHistoryEntry
  locale: string
  t: (k: string, p?: Record<string, string | number>) => string
  embedded: boolean
}) {
  const meta = [
    entry.round_number != null ? t('playerProfile.round', { round: entry.round_number }) : null,
    entry.court_name,
    formatPlayedAt(entry.played_at, locale),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li
      className={
        embedded
          ? 'border-b border-brand-border/60 px-4 py-3 last:border-0 md:px-5 md:py-3.5'
          : 'game-card px-3 py-3 md:px-4'
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold text-brand-primary md:text-base">
            {entry.session_title}
          </p>
          {meta && <p className="mt-0.5 text-xs text-brand-muted">{meta}</p>}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide md:text-xs ${
            entry.won ? 'bg-brand-accent/15 text-brand-accent' : 'bg-brand-bg-alt text-brand-muted'
          }`}
        >
          {entry.won ? t('playerProfile.won') : t('playerProfile.lost')}
        </span>
      </div>
      <p className="mt-2 font-display text-lg font-bold text-brand-text md:text-xl">{entry.score_summary}</p>
      {entry.teammates && (
        <p className="mt-1 text-xs text-brand-text md:text-sm">
          <span className="text-brand-muted">{t('playerProfile.with')}</span> {entry.teammates}
        </p>
      )}
      {entry.opponents && (
        <p className="mt-0.5 text-xs text-brand-muted md:text-sm">
          <span>{t('playerProfile.vs')}</span> {entry.opponents}
        </p>
      )}
      <p className="mt-2 text-xs font-medium text-brand-accent">
        {entry.points} {t('leaderboard.pts')}
      </p>
    </li>
  )
}

export function PlayerMatchHistory({ playerId, embedded = false }: Props) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const [entries, setEntries] = useState<PlayerMatchHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchPlayerMatchHistory(playerId).then((rows) => {
      if (!cancelled) {
        setEntries(rows)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [playerId])

  if (loading) {
    return (
      <p className={`py-8 text-center text-sm text-brand-muted ${embedded ? 'px-4 md:px-5' : ''}`}>
        {t('common.loading')}
      </p>
    )
  }

  if (entries.length === 0) {
    return (
      <p className={`py-8 text-center text-sm text-brand-muted ${embedded ? 'px-4 md:px-5' : 'game-card px-4'}`}>
        {t('playerProfile.noMatches')}
      </p>
    )
  }

  return (
    <ul className={`m-0 list-none p-0 ${embedded ? '' : 'space-y-2 pb-8'}`}>
      {entries.map((entry) => (
        <MatchRow key={entry.match_id} entry={entry} locale={locale} t={t} embedded={embedded} />
      ))}
    </ul>
  )
}
