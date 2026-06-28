import { useEffect, useRef, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import type { TranslateFn } from '../../i18n'
import { ACHIEVEMENT_IMAGE } from '../../lib/competitionAchievements'
import { copyLeaderboardImage, embedRowAvatars } from '../../lib/leaderboardShareImage'
import { shareSiteOrigin } from '../../lib/siteUrl'
import { IconShare } from '../ButtonIcons'

export type LeaderboardShareRow = {
  rank: number
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
      className="leaderboard-share-card w-[640px] overflow-hidden rounded-3xl border border-[rgb(125_211_252_/_0.24)] bg-[#061d36] text-[#f8fafc] shadow-xl"
      style={{ fontFamily: 'Roboto, ui-sans-serif, system-ui, sans-serif' }}
    >
      <div className="bg-[#0b2a4a] px-6 py-5 text-white">
        <div className="flex items-center gap-4">
          <img
            src="/brand/logo-padel.webp"
            alt=""
            width={52}
            height={52}
            className="h-[52px] w-[52px] rounded-xl bg-white/10 object-contain p-1"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              Success Padel
            </p>
            <h1
              className="truncate font-bold leading-tight text-white"
              style={{ fontFamily: 'Roboto Slab, ui-serif, Georgia, serif', fontSize: '1.35rem' }}
            >
              {title}
            </h1>
          </div>
        </div>
      </div>

      <div className="px-6 pb-5 pt-4">
        <p
          className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#d8eeff]"
          style={{ fontFamily: 'Roboto Slab, ui-serif, Georgia, serif' }}
        >
          {t('leaderboard.standings')}
        </p>

        <div className="grid grid-cols-[2rem_2.5rem_minmax(0,1fr)_4.5rem_3rem] items-center gap-x-2 border-b border-[rgb(125_211_252_/_0.24)] pb-2 text-[10px] font-semibold uppercase tracking-wide text-[#d8eeff]">
          <span className="text-center">#</span>
          <span aria-hidden />
          <span>{playerColumnLabel}</span>
          <span aria-hidden />
          <span className="text-right">{scoreUnit}</span>
        </div>

        <ol className="m-0 list-none p-0">
          {rows.map((row) => (
            <li
              key={`${row.rank}-${row.name}`}
              className={`grid grid-cols-[2rem_2.5rem_minmax(0,1fr)_4.5rem_3rem] items-center gap-x-2 border-b border-[rgb(125_211_252_/_0.24)]/80 py-2.5 last:border-0 ${
                row.rank <= 3 ? 'bg-[#11355c]/70' : ''
              }`}
            >
              <span
                className={`text-center text-sm font-bold ${
                  row.rank <= 3 ? 'text-[#efff3d]' : 'text-[#d8eeff]'
                }`}
                style={{ fontFamily: 'Roboto Slab, ui-serif, Georgia, serif' }}
              >
                {row.rank}
              </span>
              {row.avatarUrl ? (
                <img
                  src={row.avatarUrl}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover ring-1 ring-[rgb(125_211_252_/_0.24)]"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#11355c] text-sm font-semibold text-[#7dd3fc] ring-1 ring-[rgb(125_211_252_/_0.24)]">
                  {playerInitial(row.name)}
                </span>
              )}
              <span className="truncate text-base font-medium text-[#f8fafc]">{row.name}</span>
              <span className="flex items-center justify-center gap-0.5">
                {row.badges.slice(0, 2).map((badge) => {
                  const image = ACHIEVEMENT_IMAGE[badge.iconKey]
                  return image ? (
                    <img key={badge.iconKey} src={image} alt="" className="h-7 w-7 object-contain" />
                  ) : (
                    <span key={badge.iconKey} className="text-lg leading-none" aria-hidden>
                      {badge.emoji}
                    </span>
                  )
                })}
              </span>
              <span
                className="text-right text-lg font-bold tabular-nums text-[#efff3d]"
                style={{ fontFamily: 'Roboto Slab, ui-serif, Georgia, serif' }}
              >
                {row.points}
              </span>
            </li>
          ))}
        </ol>

        <p className="mt-4 text-center text-[11px] font-medium text-[#d8eeff]">{site}</p>
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
