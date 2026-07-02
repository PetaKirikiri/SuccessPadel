import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../../hooks/useTranslation'
import { useInviteCarouselNav } from './InviteCardCarousel'

type InviteCardHeaderTitleProps = {
  detailTo: string
  dateLine: string
  timeLine: string
  titleLine: string
  adminActions?: ReactNode
}

function InviteCarouselHeaderNavButton({
  direction,
  onClick,
  disabled,
  ghost,
  ariaLabel,
}: {
  direction: 'prev' | 'next'
  onClick: () => void
  disabled: boolean
  ghost: boolean
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        if (!disabled) onClick()
      }}
      disabled={disabled}
      aria-hidden={ghost}
      tabIndex={ghost ? -1 : undefined}
      aria-label={ariaLabel}
      className={`invite-carousel-header-nav invite-carousel-header-nav--${direction} ${
        ghost ? 'invite-carousel-header-nav--ghost' : ''
      } flex shrink-0 items-center justify-center rounded-full border border-brand-primary/35 bg-brand-bg-alt font-bold leading-none text-brand-primary shadow-sm transition active:scale-95 disabled:opacity-30`}
    >
      {direction === 'prev' ? '‹' : '›'}
    </button>
  )
}

export function InviteCardHeaderTitle({
  detailTo,
  dateLine,
  timeLine,
  titleLine,
  adminActions,
}: InviteCardHeaderTitleProps) {
  const { t } = useTranslation()
  const carouselNav = useInviteCarouselNav()
  const hasCarouselNav = Boolean(carouselNav?.show)

  return (
    <div className="invite-game-card__header-title">
      <div className="invite-game-card__title-nav">
        <InviteCarouselHeaderNavButton
          direction="prev"
          onClick={() => carouselNav?.onPrev()}
          disabled={!hasCarouselNav || Boolean(carouselNav?.atStart)}
          ghost={!hasCarouselNav}
          ariaLabel={t('competition.prevGame')}
        />

        <div className="invite-game-card__title-slot">
          <Link
            to={detailTo}
            className="invite-game-card__title-link touch-manipulation transition active:opacity-80"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <p className="invite-game-card__schedule-date">{dateLine}</p>
            {timeLine ? <p className="invite-game-card__schedule-time">{timeLine}</p> : null}
            <p className="invite-game-card__level">{titleLine}</p>
          </Link>
        </div>

        <InviteCarouselHeaderNavButton
          direction="next"
          onClick={() => carouselNav?.onNext()}
          disabled={!hasCarouselNav || Boolean(carouselNav?.atEnd)}
          ghost={!hasCarouselNav}
          ariaLabel={t('competition.nextGame')}
        />
      </div>

      {adminActions ? (
        <div
          className="invite-game-card__title-admin invite-card-admin-controls"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {adminActions}
        </div>
      ) : null}
    </div>
  )
}
