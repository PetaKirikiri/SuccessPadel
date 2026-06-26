import {
  Activity,
  Columns2,
  Globe2,
  Hand,
  Hash,
  Layers,
  LayoutGrid,
  Smile,
  ThumbsDown,
  Trophy,
  User,
  Venus,
  Zap,
} from 'lucide-react'
import type { TranslateFn } from '../i18n'
import { ACHIEVEMENT_IMAGE, type Achievement } from '../lib/competitionAchievements'
import { countryLabel } from '../lib/countries'
import {
  parsePlayStyles,
  PLAYER_GENDERS,
  SKILL_LEVELS,
  type PlayStyle,
  type PlayerGender,
} from '../lib/profileFields'
import type { SkillLevel } from '../lib/competitionPresets'
import {
  profileGenderFromStored,
  profileGenderLabel,
  profileHandFromStored,
  profileHandLabel,
  profilePlayStyleLabel,
  profileSideFromStored,
  profileSideLabel,
  profileSkillFromStored,
  profileSkillLabel,
} from '../lib/profileI18n'
import type { PublicPlayerProfile } from '../lib/playerProfile'
import type { DominantHand, PlaySide } from '../lib/types'
import {
  GENDER_CHIP_COLORS,
  GENDER_ICONS,
  HAND_CHIP_COLORS,
  LEVEL_CHIP_COLORS,
  LEVEL_ICONS,
  ProfileEmptyValue,
  ProfileFieldLabel,
  ProfileFormSection,
  ProfileIconChip,
  PROFILE_SECTION_ICONS,
  ProfileReadonlyValue,
  SIDE_CHIP_COLORS,
  SIDE_ICONS,
  STYLE_CHIP_COLORS,
  STYLE_ICONS,
} from './profileFormUi'

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
  badges?: Achievement[]
  showDetails?: boolean
  t: TranslateFn
}

function storedGender(profile: PublicPlayerProfile | null): PlayerGender | null {
  const g = profile?.gender
  return g && PLAYER_GENDERS.includes(g as PlayerGender) ? (g as PlayerGender) : null
}

function storedSkill(profile: PublicPlayerProfile | null): SkillLevel | null {
  const s = profile?.skill_level
  return s && SKILL_LEVELS.includes(s as SkillLevel) ? (s as SkillLevel) : null
}

function storedHand(profile: PublicPlayerProfile | null): DominantHand | null {
  const h = profile?.dominant_hand
  return h === 'left' || h === 'right' ? h : null
}

function storedSide(profile: PublicPlayerProfile | null): PlaySide | null {
  const s = profile?.preferred_side
  return s === 'left' || s === 'right' || s === 'both' ? s : null
}

export function PlayerProfileDetailsDisplay({
  profile,
  fallbackName,
  competitionStats,
  badges = [],
  showDetails = true,
  t,
}: Props) {
  const displayName = profile?.display_name?.trim() || fallbackName
  const playStyles = parsePlayStyles(profile?.play_style)
  const gender = storedGender(profile)
  const skillLevel = storedSkill(profile)
  const dominantHand = storedHand(profile)
  const preferredSide = storedSide(profile)
  const notSet = t('playerProfile.notSet')

  return (
    <div className="flex flex-col gap-3 px-4 py-3 md:px-5">
      {showDetails ? (
        <>
      <ProfileFormSection
        icon={User}
        title={t('playerProfile.details')}
        iconClassName={PROFILE_SECTION_ICONS.details}
      >
        <div className="grid grid-cols-2 gap-2.5">
          <div className="col-span-2 space-y-1 sm:col-span-1">
            <ProfileFieldLabel icon={User} iconClassName="text-brand-accent">
              {t('profile.displayName')}
            </ProfileFieldLabel>
            <ProfileReadonlyValue>{displayName || notSet}</ProfileReadonlyValue>
          </div>
          <div className="col-span-2 space-y-1 sm:col-span-1">
            <ProfileFieldLabel icon={Hash} iconClassName="text-slate-500">
              {t('playerProfile.playtomic')}
            </ProfileFieldLabel>
            <ProfileReadonlyValue>
              {profile?.playtomic_number?.trim() || notSet}
            </ProfileReadonlyValue>
          </div>
          <div className="col-span-2 space-y-1 sm:col-span-1">
            <ProfileFieldLabel icon={Globe2} iconClassName="text-sky-600">
              {t('playerProfile.country')}
            </ProfileFieldLabel>
            <ProfileReadonlyValue>{countryLabel(profile?.country) || notSet}</ProfileReadonlyValue>
          </div>
          <div className="col-span-2 space-y-1">
            <ProfileFieldLabel icon={Zap} iconClassName="text-orange-600">
              {t('playerProfile.racket')}
            </ProfileFieldLabel>
            <ProfileReadonlyValue>{profile?.racket?.trim() || notSet}</ProfileReadonlyValue>
          </div>
        </div>
      </ProfileFormSection>

      <div className="grid grid-cols-2 gap-3">
        <ProfileFormSection
          icon={Venus}
          title={t('playerProfile.gender')}
          iconClassName={PROFILE_SECTION_ICONS.gender}
        >
          {gender ? (
            <div className="grid grid-cols-2 gap-1.5">
              <ProfileIconChip
                compact
                active
                icon={GENDER_ICONS[gender]}
                iconClassName={GENDER_CHIP_COLORS[gender]}
                label={profileGenderFromStored(profile?.gender, t) ?? profileGenderLabel(gender, t)}
              />
            </div>
          ) : (
            <ProfileEmptyValue>{notSet}</ProfileEmptyValue>
          )}
        </ProfileFormSection>
        <ProfileFormSection
          icon={Hand}
          title={t('playerProfile.hand')}
          iconClassName={PROFILE_SECTION_ICONS.hand}
        >
          {dominantHand ? (
            <div className="grid grid-cols-2 gap-1.5">
              <ProfileIconChip
                compact
                active
                icon={Hand}
                iconClassName={`${HAND_CHIP_COLORS[dominantHand]} ${dominantHand === 'left' ? '-scale-x-100' : ''}`}
                label={profileHandFromStored(profile?.dominant_hand, t) ?? profileHandLabel(dominantHand, t)}
              />
            </div>
          ) : (
            <ProfileEmptyValue>{notSet}</ProfileEmptyValue>
          )}
        </ProfileFormSection>
      </div>

      <ProfileFormSection
        icon={Layers}
        title={t('playerProfile.level')}
        iconClassName={PROFILE_SECTION_ICONS.level}
      >
        {skillLevel ? (
          <div className="grid grid-cols-5 gap-1.5">
            <ProfileIconChip
              compact
              active
              icon={LEVEL_ICONS[skillLevel]}
              iconClassName={LEVEL_CHIP_COLORS[skillLevel]}
              label={profileSkillFromStored(profile?.skill_level, t) ?? profileSkillLabel(skillLevel, t)}
              multilineLabel
            />
          </div>
        ) : (
          <ProfileEmptyValue>{notSet}</ProfileEmptyValue>
        )}
      </ProfileFormSection>

      <ProfileFormSection
        icon={LayoutGrid}
        title={t('playerProfile.playStyle')}
        iconClassName={PROFILE_SECTION_ICONS.playStyle}
      >
        {playStyles.length > 0 ? (
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
            {playStyles.map((style: PlayStyle) => (
              <ProfileIconChip
                key={style}
                compact
                active
                icon={STYLE_ICONS[style]}
                iconClassName={STYLE_CHIP_COLORS[style]}
                label={profilePlayStyleLabel(style, t)}
              />
            ))}
          </div>
        ) : (
          <ProfileEmptyValue>{notSet}</ProfileEmptyValue>
        )}
      </ProfileFormSection>

      <div className="grid grid-cols-2 gap-3">
        <ProfileFormSection
          icon={Columns2}
          title={t('playerProfile.preferredSide')}
          iconClassName={PROFILE_SECTION_ICONS.side}
        >
          {preferredSide ? (
            <div className="grid grid-cols-3 gap-1.5">
              <ProfileIconChip
                compact
                active
                icon={SIDE_ICONS[preferredSide]}
                iconClassName={SIDE_CHIP_COLORS[preferredSide]}
                label={profileSideFromStored(profile?.preferred_side, t) ?? profileSideLabel(preferredSide, t)}
              />
            </div>
          ) : (
            <ProfileEmptyValue>{notSet}</ProfileEmptyValue>
          )}
        </ProfileFormSection>
        <ProfileFormSection
          icon={Smile}
          title={t('playerProfile.funGames')}
          iconClassName={PROFILE_SECTION_ICONS.fun}
        >
          {profile ? (
            <div className="grid grid-cols-2 gap-1.5">
              <ProfileIconChip
                compact
                active={profile.enjoys_fun_games}
                icon={Smile}
                iconClassName="text-lime-600"
                label={t('playerProfile.yes')}
              />
              <ProfileIconChip
                compact
                active={!profile.enjoys_fun_games}
                icon={ThumbsDown}
                iconClassName="text-stone-500"
                label={t('playerProfile.no')}
              />
            </div>
          ) : (
            <ProfileEmptyValue>{notSet}</ProfileEmptyValue>
          )}
        </ProfileFormSection>
      </div>

      <ProfileFormSection
        icon={Activity}
        title={t('playerProfile.usuallyFree')}
        iconClassName={PROFILE_SECTION_ICONS.usuallyFree}
      >
        <ProfileReadonlyValue>{profile?.usually_free?.trim() || notSet}</ProfileReadonlyValue>
      </ProfileFormSection>
        </>
      ) : null}

      {showDetails && competitionStats ? (
        <ProfileFormSection
          icon={Trophy}
          title={t('playerProfile.competition')}
          iconClassName={PROFILE_SECTION_ICONS.level}
        >
          <ProfileReadonlyValue>
            {t('playerProfile.competitionSummary', {
              rank: competitionStats.rank,
              points: competitionStats.points,
              unit: competitionStats.unit,
              games: competitionStats.games,
            })}
          </ProfileReadonlyValue>
        </ProfileFormSection>
      ) : null}

      {badges.length > 0 ? (
        <ProfileFormSection
          icon={Trophy}
          title={t('playerProfile.achievements')}
          iconClassName={PROFILE_SECTION_ICONS.details}
        >
          <ul className="m-0 list-none space-y-2 p-0">
            {badges.map((b) => {
              const image = ACHIEVEMENT_IMAGE[b.key]
              return (
                <li
                  key={b.key}
                  className="flex items-center gap-3 rounded-lg border border-brand-border/80 bg-brand-surface px-3 py-2.5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center">
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
        </ProfileFormSection>
      ) : null}
    </div>
  )
}
