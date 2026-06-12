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
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {avatar}
        <div className="min-w-0">
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
      </div>
      {canAddLine && onAddLine && (
        <button
          type="button"
          onClick={onAddLine}
          aria-label={t('playerProfile.connectLine')}
          className="ml-auto flex shrink-0 flex-col items-center gap-1.5 rounded-xl border-2 border-[#06C755] bg-[#06C755]/12 px-3 py-2.5 shadow-sm active:scale-[0.98]"
        >
          <img
            src="/brand/line-logo.png"
            alt=""
            className="h-10 w-10 rounded-lg object-cover shadow-md ring-2 ring-[#06C755]/45 md:h-11 md:w-11"
          />
          <span className="max-w-[5.5rem] text-center text-[10px] font-bold leading-tight text-[#06C755]">
            {t('playerProfile.connectLine')}
          </span>
        </button>
      )}
    </div>
  )
}
