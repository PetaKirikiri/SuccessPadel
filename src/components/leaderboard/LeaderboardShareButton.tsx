import { useEffect, useRef, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import type { TranslateFn } from '../../i18n'
import { ACHIEVEMENT_IMAGE } from '../../lib/competitionAchievements'
import { copyLeaderboardImage, embedRowAvatars } from '../../lib/leaderboardShareImage'
import { shareSiteOrigin } from '../../lib/siteUrl'
import { IconShare } from '../../shared/Button/ButtonIcons'

export type LeaderboardShareRow = {
  name: string
  points: number
  avatarUrl?: string | null
  badges: { iconKey: string; emoji: string }[]
}

type Props = {
  title: string
  rows: LeaderboardShareRow[]
  scoreUnit: string
  playerColumnLabel: string
  t: TranslateFn
  compact?: boolean
}

function playerInitial(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed[0]!.toUpperCase() : '?'
}

function LeaderboardShareCard({
  title,
  rows,
  scoreUnit,
  playerColumnLabel,
  t,
  cardRef,
}: Props & { cardRef: RefObject<HTMLDivElement | null> }) {
  const site = shareSiteOrigin().replace(/^https?:\/\//, '')

  return (
    <div
      ref={cardRef}
      className="leaderboard-share-card"
    >
      <div className="leaderboard-share-card__header">
        <div className="leaderboard-share-card__header-content">
          <img
            src="/brand/logo-padel.webp"
            alt=""
            width={52}
            height={52}
            className="leaderboard-share-card__logo"
          />
          <div className="leaderboard-share-card__heading">
            <p className="leaderboard-share-card__eyebrow">
              Success Padel
            </p>
            <h1 className="leaderboard-share-card__title">{title}</h1>
          </div>
        </div>
      </div>

      <div className="leaderboard-share-card__body">
        <p className="leaderboard-share-card__section-title">{t('leaderboard.standings')}</p>

        <div className="leaderboard-share-card__columns">
          <span className="leaderboard-share-card__rank-heading">#</span>
          <span aria-hidden />
          <span>{playerColumnLabel}</span>
          <span aria-hidden />
          <span className="leaderboard-share-card__score-heading">{scoreUnit}</span>
        </div>

        <ol className="leaderboard-share-card__list">
          {rows.map((row, index) => {
            const position = index + 1
            return (
            <li
              key={`${position}-${row.name}`}
              className={`leaderboard-share-card__row leaderboard-share-card__row--position-${Math.min(position, 4)}`}
            >
              <span className="leaderboard-share-card__rank">{position}</span>
              {row.avatarUrl ? (
                <img
                  src={row.avatarUrl}
                  alt=""
                  className="leaderboard-share-card__avatar"
                />
              ) : (
                <span className="leaderboard-share-card__avatar-fallback">
                  {playerInitial(row.name)}
                </span>
              )}
              <span className="leaderboard-share-card__player-name">{row.name}</span>
              <span className="leaderboard-share-card__badges">
                {row.badges.slice(0, 2).map((badge) => {
                  const image = ACHIEVEMENT_IMAGE[badge.iconKey]
                  return image ? (
                    <img
                      key={badge.iconKey}
                      src={image}
                      alt=""
                      className="leaderboard-share-card__badge-image"
                    />
                  ) : (
                    <span key={badge.iconKey} className="leaderboard-share-card__badge-emoji" aria-hidden>
                      {badge.emoji}
                    </span>
                  )
                })}
              </span>
              <span className="leaderboard-share-card__score">{row.points}</span>
            </li>
            )
          })}
        </ol>

        <p className="leaderboard-share-card__footer">{site}</p>
      </div>
    </div>
  )
}

export function LeaderboardShareButton({ title, rows, scoreUnit, playerColumnLabel, t, compact }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [captureRows, setCaptureRows] = useState(rows)

  useEffect(() => {
    if (!busy) setCaptureRows(rows)
  }, [rows, busy])

  const share = async () => {
    if (!cardRef.current || busy || rows.length === 0) return
    setBusy(true)
    setFeedback(null)
    try {
      const embedded = await embedRowAvatars(rows)
      flushSync(() => setCaptureRows(embedded))
      const result = await copyLeaderboardImage(cardRef.current, title)
      setFeedback(
        result === 'copied'
          ? t('leaderboard.imageCopied')
          : result === 'shared'
            ? t('leaderboard.imageShared')
            : t('leaderboard.imageDownloaded'),
      )
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setFeedback(t('leaderboard.imageCopyFailed'))
    } finally {
      flushSync(() => setCaptureRows(rows))
      setBusy(false)
      window.setTimeout(() => setFeedback(null), 2800)
    }
  }

  return (
    <>
      <div className={`relative shrink-0 ${compact ? '' : ''}`}>
        <button
          type="button"
          disabled={busy}
          onClick={() => void share()}
          aria-label={t('leaderboard.shareImage')}
          className="flex h-9 items-center gap-1.5 rounded-full border border-brand-border bg-brand-bg-alt px-3 text-xs font-semibold text-brand-primary shadow-sm transition active:scale-[0.98] disabled:opacity-60 md:h-10 md:px-3.5 md:text-sm"
        >
          <IconShare />
          <span>{t('leaderboard.shareImage')}</span>
        </button>
        {feedback ? (
          <p className="absolute right-0 top-full z-10 mt-1 max-w-[14rem] whitespace-normal rounded-lg bg-brand-surface px-2.5 py-1 text-[10px] font-medium text-brand-muted shadow-md md:text-xs">
            {feedback}
          </p>
        ) : null}
      </div>

      <div
        className="pointer-events-none fixed left-0 top-0 -z-10 w-[640px] opacity-0"
        aria-hidden
      >
        <LeaderboardShareCard
          cardRef={cardRef}
          title={title}
          rows={captureRows}
          scoreUnit={scoreUnit}
          playerColumnLabel={playerColumnLabel}
          t={t}
        />
      </div>
    </>
  )
}
