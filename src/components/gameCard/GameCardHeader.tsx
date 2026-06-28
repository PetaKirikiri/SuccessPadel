import type { TranslateFn } from '../../i18n'
import type { GameCardSize } from '../../lib/viewBreakpoints'
import { IconHubLeaderboard } from '../ShellTabIcons'
import { TvPlayQrPanel } from '../play/TvPlayQrPanel'
import type { TvGameNav } from '../play/TvGameCarousel'
import {
  gameTitleClassForSize,
  headerCarouselMinHeightForSize,
  headerPadForSize,
  hideCollapseForSize,
  isTvSize,
} from './gameCardSizes'

function GameCardBackButton({
  onClick,
  ariaLabel,
  finished = false,
}: {
  onClick: () => void
  ariaLabel: string
  finished?: boolean
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-label={ariaLabel}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-lg font-medium leading-none shadow-sm transition active:scale-95 ${
        finished
          ? 'border-brand-border/60 bg-brand-bg-alt text-brand-primary'
          : 'border-white/25 bg-white/10 text-brand-bg-alt dark:border-white/15 dark:text-brand-accent-light'
      }`}
    >
      ←
    </button>
  )
}

function GameCardLeaderboardButton({
  active,
  onClick,
  ariaLabel,
  finished = false,
}: {
  active: boolean
  onClick: () => void
  ariaLabel: string
  finished?: boolean
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-lg leading-none shadow-sm transition active:scale-95 ${
        active
          ? 'border-brand-accent bg-brand-accent/20 ring-2 ring-brand-accent/60'
          : finished
            ? 'border-brand-border/60 bg-brand-bg-alt text-brand-primary'
            : 'border-white/25 bg-white/10 text-brand-bg-alt dark:border-white/15 dark:text-brand-accent-light'
      }`}
    >
      <IconHubLeaderboard className="h-4 w-4" />
    </button>
  )
}

function GameCardGameNavButton({
  direction,
  onClick,
  disabled,
  ariaLabel,
  finished = false,
}: {
  direction: 'prev' | 'next'
  onClick: () => void
  disabled: boolean
  ariaLabel: string
  finished?: boolean
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`game-card-header-nav-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xl font-bold leading-none shadow-sm transition active:scale-95 disabled:opacity-30 md:h-9 md:w-9 md:text-2xl ${
        finished
          ? 'border-brand-border/60 bg-brand-bg-alt text-brand-primary'
          : 'border-white/25 bg-white/10 text-brand-bg-alt dark:border-white/15 dark:text-brand-accent-light'
      }`}
    >
      {direction === 'prev' ? '‹' : '›'}
    </button>
  )
}

export function GameCardHeader({
  gameNumber,
  isLiveNow,
  timeLabel,
  countdown,
  countdownLabelText,
  finished,
  collapsed,
  onToggleCollapsed,
  size,
  tvNav,
  onBack,
  viewAlongUrl,
  onLeaderboardToggle,
  leaderboardActive = false,
  t,
}: {
  gameNumber: number
  isLiveNow?: boolean
  timeLabel?: string
  countdown?: string | null
  countdownLabelText: string
  finished: boolean
  collapsed: boolean
  onToggleCollapsed: () => void
  size: GameCardSize
  tvNav?: TvGameNav
  onBack?: () => void
  viewAlongUrl?: string | null
  onLeaderboardToggle?: () => void
  leaderboardActive?: boolean
  t: TranslateFn
}) {
  const tv = isTvSize(size)
  const hideCollapse = hideCollapseForSize(size)
  const showLiveBadge = !finished && isLiveNow
  const headerPad = headerPadForSize(size)
  const gameTitleClass = gameTitleClassForSize(size)
  const headerShellClass = `flex items-stretch border-b-2 ${
    finished
      ? 'border-brand-border/50 bg-[#e8e7e5] dark:border-white/12 dark:bg-white/[0.06]'
      : 'border-brand-accent/50 bg-brand-primary dark:border-brand-accent/40 dark:bg-white/[0.08]'
  }`
  const collapseBtnClass = `flex min-w-12 shrink-0 items-center justify-center self-stretch border-l px-4 text-2xl leading-none transition active:opacity-70 md:min-w-14 md:px-5 md:text-3xl ${
    finished
      ? 'border-brand-border/50 text-brand-sage/80 dark:text-brand-muted'
      : 'border-white/25 text-brand-bg-alt dark:border-white/15 dark:text-brand-muted'
  }`

  const countdownBlock = countdown ? (
    <div className={`shrink-0 text-right ${tv ? 'px-3 py-1' : ''}`} aria-live="polite">
      <p
        className={`font-semibold uppercase tracking-wide ${
          tv ? 'text-sm' : 'text-[10px] md:text-xs'
        } ${finished ? 'text-brand-muted' : 'text-white/80 dark:text-brand-muted'}`}
      >
        {countdownLabelText}
      </p>
      <p
        className={`font-display font-bold leading-none tabular-nums ${
          tv ? 'text-4xl md:text-5xl' : size === 'web' ? 'text-2xl lg:text-3xl' : 'text-2xl md:text-3xl'
        } ${finished ? 'text-brand-muted' : 'text-[#7dd3fc]'}`}
      >
        {countdown}
      </p>
    </div>
  ) : null

  if (tvNav) {
    return (
      <div className={headerShellClass}>
        <div
          className={`relative min-w-0 w-full flex-1 ${headerCarouselMinHeightForSize(size)} ${headerPad}`}
        >
          <div className="absolute inset-y-0 left-0 z-10 flex items-center">
            {onBack ? (
              <GameCardBackButton onClick={onBack} ariaLabel={t('aria.back')} finished={finished} />
            ) : null}
          </div>

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="pointer-events-auto flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-2 md:gap-3">
                <GameCardGameNavButton
                  direction="prev"
                  onClick={tvNav.onPrev}
                  disabled={tvNav.atStart}
                  ariaLabel={t('competition.prevGame')}
                  finished={finished}
                />
                <p
                  className={`shrink-0 text-center ${gameTitleClass} ${
                    finished ? 'text-brand-muted' : 'text-[#7dd3fc]'
                  }`}
                >
                  {t('competition.game', { number: gameNumber })}
                </p>
                <GameCardGameNavButton
                  direction="next"
                  onClick={tvNav.onNext}
                  disabled={tvNav.atEnd}
                  ariaLabel={t('competition.nextGame')}
                  finished={finished}
                />
              </div>
              {showLiveBadge ? (
                <span
                  className={`text-xs font-semibold md:text-sm ${
                    finished ? 'text-brand-muted' : 'text-[#7dd3fc]/80'
                  }`}
                >
                  {t('competition.live')}
                </span>
              ) : finished ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-muted md:text-sm">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-muted/55" aria-hidden />
                  {t('competition.done')}
                </span>
              ) : null}
              {timeLabel && !countdown ? (
                <span
                  className={`text-[11px] tabular-nums md:text-sm ${
                    finished ? 'text-brand-muted' : 'text-[#7dd3fc]/70'
                  }`}
                >
                  {timeLabel}
                </span>
              ) : null}
            </div>
          </div>

          <div className="absolute inset-y-0 right-0 z-10 flex items-center justify-end gap-2">
            {countdownBlock}
            {onLeaderboardToggle ? (
              <GameCardLeaderboardButton
                active={leaderboardActive}
                onClick={onLeaderboardToggle}
                ariaLabel={t('competition.leaderboard')}
                finished={finished}
              />
            ) : null}
            {viewAlongUrl ? <TvPlayQrPanel url={viewAlongUrl} header /> : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={headerShellClass}>
      <div className={`grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 md:gap-3 ${headerPad}`}>
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          {onBack ? (
            <GameCardBackButton onClick={onBack} ariaLabel={t('aria.back')} finished={finished} />
          ) : null}
          <div className="min-w-0">
            {showLiveBadge ? (
              <span
                className={`text-xs font-semibold md:text-sm ${
                  finished ? 'text-brand-accent' : 'text-brand-bg-alt dark:text-brand-fun'
                }`}
              >
                {t('competition.live')}
              </span>
            ) : finished ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-muted md:text-sm">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-sage/60 dark:bg-brand-muted/60" aria-hidden />
                {t('competition.done')}
              </span>
            ) : null}
            {timeLabel && !countdown ? (
              <span
                className={`mt-0.5 block text-[11px] tabular-nums md:text-sm ${
                  finished ? 'text-brand-muted' : 'text-white/75 dark:text-brand-muted'
                }`}
              >
                {timeLabel}
              </span>
            ) : null}
          </div>
        </div>
        <p
          className={`min-w-0 truncate text-center ${gameTitleClass} ${
            finished ? 'text-brand-sage dark:text-brand-muted' : 'text-brand-accent-light dark:text-brand-fun'
          }`}
        >
          {t('competition.game', { number: gameNumber })}
        </p>
        <div className="flex min-w-0 items-center justify-end gap-2">
        {countdown && !tv ? (
          <div className="shrink-0 text-right" aria-live="polite">
            <p
              className={`text-[10px] font-semibold uppercase tracking-wide md:text-xs ${
                finished ? 'text-brand-muted' : 'text-white/65 dark:text-brand-muted'
              }`}
            >
              {countdownLabelText}
            </p>
            <p
              className={`font-display text-2xl font-bold leading-none tabular-nums md:text-3xl ${
                finished ? 'text-brand-primary dark:text-brand-text' : 'text-brand-bg-alt dark:text-brand-text'
              }`}
            >
              {countdown}
            </p>
          </div>
        ) : null}
        {onLeaderboardToggle ? (
          <GameCardLeaderboardButton
            active={leaderboardActive}
            onClick={onLeaderboardToggle}
            ariaLabel={t('competition.leaderboard')}
            finished={finished}
          />
        ) : null}
        </div>
      </div>
      {!hideCollapse ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          className={collapseBtnClass}
        >
          {collapsed ? '▸' : '▾'}
        </button>
      ) : null}
    </div>
  )
}
