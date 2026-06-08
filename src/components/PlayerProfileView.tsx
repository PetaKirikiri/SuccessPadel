import type { TranslateFn } from '../i18n'
import { ACHIEVEMENT_IMAGE, type Achievement } from '../lib/competitionAchievements'
import { parsePlayStyles, playSideLabel } from '../lib/profileFields'
import type { PublicPlayerProfile } from '../lib/playerProfile'

type CompetitionStats = {
  rank: number
  points: number
  games: number
  unit: string
}

type Props = {
  profile: PublicPlayerProfile | null
  fallbackName: string
  competitionStats?: CompetitionStats | null
  badges: Achievement[]
  showDetails?: boolean
  embedded?: boolean
  t: TranslateFn
}

function ReadChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-lg border border-brand-border bg-brand-bg-alt px-2.5 py-1 text-xs font-medium text-brand-text">
      {children}
    </span>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b border-brand-border/50 py-3 last:border-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{label}</p>
      <div className="mt-1 text-sm text-brand-text">{value}</div>
    </div>
  )
}

export function PlayerProfileView({
  profile,
  fallbackName,
  competitionStats,
  badges,
  showDetails = true,
  embedded = false,
  t,
}: Props) {
  const displayName = profile?.display_name?.trim() || fallbackName
  const playStyles = parsePlayStyles(profile?.play_style)
  const sideLabel = playSideLabel(profile?.preferred_side)
  const notSet = <span className="text-brand-muted">{t('playerProfile.notSet')}</span>

  const bodyClass = embedded ? 'px-4 py-3 md:px-5' : 'game-card px-4 py-3 md:px-5'
  const sectionClass = embedded ? 'border-t border-brand-border/60 px-4 py-3 md:px-5' : 'game-card px-4 py-3 md:px-5'

  return (
    <div className={embedded ? '' : 'space-y-3 pb-8'}>
      {showDetails && (
      <section className={bodyClass}>
        {!embedded && (
          <h2 className="font-display text-sm font-semibold text-brand-primary md:text-base">
            {t('playerProfile.details')}
          </h2>
        )}
        <div className={embedded ? '' : 'mt-1'}>
          <Field label={t('profile.displayName')} value={displayName || notSet} />
          <Field
            label={t('playerProfile.playtomic')}
            value={profile?.playtomic_number?.trim() || notSet}
          />
          <Field label={t('playerProfile.racket')} value={profile?.racket?.trim() || notSet} />
          <Field
            label={t('playerProfile.playStyle')}
            value={
              playStyles.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {playStyles.map((style) => (
                    <ReadChip key={style}>{style}</ReadChip>
                  ))}
                </div>
              ) : (
                notSet
              )
            }
          />
          <Field
            label={t('playerProfile.preferredSide')}
            value={sideLabel ? <ReadChip>{sideLabel}</ReadChip> : notSet}
          />
          <Field
            label={t('playerProfile.funGames')}
            value={
              profile
                ? profile.enjoys_fun_games
                  ? t('playerProfile.yes')
                  : t('playerProfile.no')
                : notSet
            }
          />
          <Field
            label={t('playerProfile.usuallyFree')}
            value={profile?.usually_free?.trim() || notSet}
          />
        </div>
      </section>
      )}

      {competitionStats && (
        <section className={sectionClass}>
          <h2 className="font-display text-sm font-semibold text-brand-primary md:text-base">
            {t('playerProfile.competition')}
          </h2>
          <p className="mt-2 text-sm text-brand-text">
            {t('playerProfile.competitionSummary', {
              rank: competitionStats.rank,
              points: competitionStats.points,
              unit: competitionStats.unit,
              games: competitionStats.games,
            })}
          </p>
        </section>
      )}

      {badges.length > 0 && (
        <section className={sectionClass}>
          <h2 className="font-display text-sm font-semibold text-brand-primary md:text-base">
            {t('playerProfile.achievements')}
          </h2>
          <ul className="m-0 mt-2 list-none space-y-2 p-0">
            {badges.map((b) => {
              const image = ACHIEVEMENT_IMAGE[b.key]
              return (
                <li
                  key={b.key}
                  className="flex items-center gap-3 rounded-xl border border-brand-border/60 px-3 py-2.5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center md:h-10 md:w-10">
                    {image ? (
                      <img src={image} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-2xl leading-none" aria-hidden>
                        {b.icon}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-brand-text">
                      {t(b.labelKey)}
                    </span>
                    <span className="block text-xs text-brand-muted">{t(`${b.labelKey}Desc`)}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

    </div>
  )
}
