import type { TranslateFn } from '../i18n'

type Props = {
  name: string
  avatarUrl?: string | null
  memberSince?: string | null
  canAddLine: boolean
  onAddLine?: () => void
  onChangePhoto?: () => void
  changePhotoLabel?: string
  embedded?: boolean
  t: TranslateFn
}

function initial(name: string): string {
  const s = name.trim()
  return s ? s[0]!.toUpperCase() : '?'
}

export function PlayerProfileBanner({
  name,
  avatarUrl,
  memberSince,
  canAddLine,
  onAddLine,
  onChangePhoto,
  changePhotoLabel,
  embedded = false,
  t,
}: Props) {
  const avatar = onChangePhoto ? (
    <button
      type="button"
      onClick={onChangePhoto}
      className="relative shrink-0"
      aria-label={changePhotoLabel}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-16 w-16 rounded-full object-cover ring-2 ring-brand-border md:h-20 md:w-20"
        />
      ) : (
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-bg-alt text-xl font-semibold text-brand-muted ring-2 ring-brand-border md:h-20 md:w-20">
          {initial(name)}
        </span>
      )}
    </button>
  ) : avatarUrl ? (
    <img
      src={avatarUrl}
      alt=""
      className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-brand-border md:h-20 md:w-20"
    />
  ) : (
    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-bg-alt text-xl font-semibold text-brand-muted ring-2 ring-brand-border md:h-20 md:w-20">
      {initial(name)}
    </span>
  )

  return (
    <div
      className={`flex items-center gap-3 px-4 py-4 ${embedded ? 'border-b border-brand-border/60' : 'game-card'}`}
    >
      {avatar}
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-lg font-bold text-brand-primary md:text-xl">{name}</h1>
        {onChangePhoto && changePhotoLabel && (
          <button
            type="button"
            onClick={onChangePhoto}
            className="mt-0.5 text-xs font-medium text-brand-accent"
          >
            {changePhotoLabel}
          </button>
        )}
        {memberSince && !onChangePhoto && (
          <p className="mt-0.5 text-xs text-brand-muted">
            {t('playerProfile.memberSince', { date: memberSince })}
          </p>
        )}
      </div>
      {canAddLine && onAddLine && (
        <button
          type="button"
          onClick={onAddLine}
          aria-label={t('leaderboard.addLine')}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-brand-border bg-brand-surface py-1.5 pl-3 pr-1.5 md:py-2 md:pl-3.5 md:pr-2"
        >
          <span className="text-sm font-semibold text-brand-text">{t('leaderboard.add')}</span>
          <img src="/brand/line-logo.png" alt="" className="h-8 w-8 rounded-md object-cover md:h-9 md:w-9" />
        </button>
      )}
    </div>
  )
}
