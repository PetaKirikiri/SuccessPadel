import { Share2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LineLogoIcon } from './LineLogoIcon'
import { GameLineupSprite } from './GameLineupSprite'
import type { TranslateFn } from '../i18n'

type Props = {
  name: string
  avatarUrl?: string | null
  showdownSpriteUrl?: string | null
  fighterEditTo?: string
  fighterEditLabel?: string
  memberSince?: string | null
  canAddLine: boolean
  onAddLine?: () => void
  canShareProfile?: boolean
  onShareProfile?: () => void
  shareProfileLabel?: string
  shareFeedback?: string | null
  /** When set, avatar and change-photo use a <label htmlFor> (reliable on mobile web). */
  photoInputId?: string
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
  showdownSpriteUrl,
  fighterEditTo,
  fighterEditLabel,
  memberSince,
  canAddLine,
  onAddLine,
  canShareProfile = false,
  onShareProfile,
  shareProfileLabel = 'Share profile',
  shareFeedback = null,
  photoInputId,
  onChangePhoto,
  changePhotoLabel,
  embedded = false,
  t,
}: Props) {
  const canChangePhoto = Boolean(photoInputId || onChangePhoto)
  const avatarClass =
    'relative shrink-0 cursor-pointer'
  const avatarVisual = avatarUrl ? (
    <img
      src={avatarUrl}
      alt=""
      className="h-16 w-16 rounded-full object-cover ring-2 ring-brand-border md:h-20 md:w-20"
    />
  ) : (
    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-bg-alt text-xl font-semibold text-brand-muted ring-2 ring-brand-border md:h-20 md:w-20">
      {initial(name)}
    </span>
  )

  const avatar = canChangePhoto ? (
    photoInputId ? (
      <label htmlFor={photoInputId} className={avatarClass} aria-label={changePhotoLabel}>
        {avatarVisual}
      </label>
    ) : (
      <button
        type="button"
        onClick={onChangePhoto}
        className={avatarClass}
        aria-label={changePhotoLabel}
      >
        {avatarVisual}
      </button>
    )
  ) : (
    <span className="relative shrink-0">{avatarVisual}</span>
  )

  return (
    <div
      className={`flex items-center gap-3 px-4 py-4 ${embedded ? 'border-b border-brand-border/60' : 'game-card'}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {avatar}
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-bold text-brand-primary md:text-xl">{name}</h1>
          {canChangePhoto && changePhotoLabel ? (
            photoInputId ? (
              <label
                htmlFor={photoInputId}
                className="mt-0.5 block cursor-pointer text-xs font-medium text-brand-accent"
              >
                {changePhotoLabel}
              </label>
            ) : (
              <button
                type="button"
                onClick={onChangePhoto}
                className="mt-0.5 text-xs font-medium text-brand-accent"
              >
                {changePhotoLabel}
              </button>
            )
          ) : null}
          {memberSince && !canChangePhoto && (
            <p className="mt-0.5 text-xs text-brand-muted">
              {t('playerProfile.memberSince', { date: memberSince })}
            </p>
          )}
        </div>
      </div>
      {(canShareProfile || canAddLine || showdownSpriteUrl || fighterEditTo) && (
        <div className="flex shrink-0 items-end gap-2">
          {(canShareProfile || canAddLine) && (
            <div className="flex flex-col items-end gap-2">
              {canShareProfile && onShareProfile && (
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={onShareProfile}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-bg-alt px-3 py-2 text-xs font-semibold text-brand-primary shadow-sm active:scale-[0.98]"
                  >
                    <Share2 className="h-3.5 w-3.5" aria-hidden />
                    {shareProfileLabel}
                  </button>
                  {shareFeedback && (
                    <p className="text-[10px] font-medium text-brand-muted">{shareFeedback}</p>
                  )}
                </div>
              )}
              {canAddLine && onAddLine && (
                <button
                  type="button"
                  onClick={onAddLine}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-bg-alt px-3 py-2 text-xs font-semibold text-brand-primary shadow-sm active:scale-[0.98]"
                >
                  <LineLogoIcon className="h-4 w-4" />
                  {t('playerProfile.connectLine')}
                </button>
              )}
            </div>
          )}
          {(showdownSpriteUrl || fighterEditTo) ? (
            <div className="flex flex-col items-end gap-1">
              {showdownSpriteUrl ? (
                fighterEditTo ? (
                  <Link
                    to={fighterEditTo}
                    aria-label={fighterEditLabel}
                    className="rounded-lg px-1 py-0.5 opacity-80 transition active:scale-[0.98] active:opacity-100"
                  >
                    <GameLineupSprite
                      src={showdownSpriteUrl}
                      facing="right"
                      size={52}
                      className="h-12 w-12 md:h-16 md:w-16"
                    />
                  </Link>
                ) : (
                  <GameLineupSprite
                    src={showdownSpriteUrl}
                    facing="right"
                    size={52}
                    className="h-12 w-12 opacity-75 md:h-16 md:w-16"
                  />
                )
              ) : null}
              {fighterEditTo ? (
                <Link
                  to={fighterEditTo}
                  className="text-[10px] font-semibold leading-none text-brand-muted underline-offset-2 active:text-brand-accent"
                >
                  {fighterEditLabel}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
