import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Activity,
  CircleDot,
  Columns2,
  Crosshair,
  Flame,
  Hand,
  Hash,
  Layers,
  LayoutGrid,
  Mars,
  Minus,
  Network,
  Shield,
  Smile,
  ThumbsDown,
  Trophy,
  TrendingUp,
  User,
  Venus,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from '../hooks/useTranslation'
import { uploadProfileAvatar, validateProfileAvatar } from '../lib/profileAvatar'
import {
  DOMINANT_HANDS,
  parsePlayStyles,
  PLAYER_GENDERS,
  PLAY_SIDES,
  PLAY_STYLES,
  serializePlayStyles,
  SKILL_LEVELS,
  type PlayStyle,
  type PlayerGender,
} from '../lib/profileFields'
import type { SkillLevel } from '../lib/competitionPresets'
import { firstDisplayName } from '../lib/leaderboardEntries'
import {
  profileGenderLabel,
  profileHandLabel,
  profilePlayStyleLabel,
  profileSideLabel,
  profileSkillLabel,
} from '../lib/profileI18n'
import { supabase } from '../lib/supabaseClient'
import type { DominantHand, PlaySide, Profile } from '../lib/types'

const GENDER_ICONS: Record<PlayerGender, LucideIcon> = { Male: Mars, Female: Venus }
const GENDER_CHIP_COLORS: Record<PlayerGender, string> = {
  Male: 'text-blue-600',
  Female: 'text-fuchsia-600',
}
const HAND_CHIP_COLORS: Record<DominantHand, string> = {
  left: 'text-sky-600',
  right: 'text-indigo-600',
}
const LEVEL_ICONS: Record<SkillLevel, LucideIcon> = {
  Beginner: CircleDot,
  'Low Inter': TrendingUp,
  Intermediate: Activity,
  Advanced: Flame,
  Open: Trophy,
}
const LEVEL_CHIP_COLORS: Record<SkillLevel, string> = {
  Beginner: 'text-stone-500',
  'Low Inter': 'text-emerald-600',
  Intermediate: 'text-blue-600',
  Advanced: 'text-orange-600',
  Open: 'text-amber-600',
}
const STYLE_ICONS: Record<PlayStyle, LucideIcon> = {
  Aggressive: Flame,
  Defensive: Shield,
  'All-court': LayoutGrid,
  'Net player': Network,
  Baseline: Minus,
  Power: Zap,
  Control: Crosshair,
}
const STYLE_CHIP_COLORS: Record<PlayStyle, string> = {
  Aggressive: 'text-red-600',
  Defensive: 'text-blue-600',
  'All-court': 'text-violet-600',
  'Net player': 'text-cyan-600',
  Baseline: 'text-stone-600',
  Power: 'text-orange-600',
  Control: 'text-teal-600',
}
const SIDE_ICONS: Record<PlaySide, LucideIcon> = {
  left: Zap,
  right: Crosshair,
  both: Columns2,
}
const SIDE_CHIP_COLORS: Record<PlaySide, string> = {
  left: 'text-orange-600',
  right: 'text-teal-600',
  both: 'text-violet-600',
}

export type EditableProfile = Pick<
  Profile,
  | 'id'
  | 'display_name'
  | 'avatar_url'
  | 'playtomic_number'
  | 'racket'
  | 'play_style'
  | 'preferred_side'
  | 'enjoys_fun_games'
  | 'usually_free'
  | 'gender'
  | 'dominant_hand'
  | 'skill_level'
>

function FormSection({
  icon: Icon,
  title,
  children,
  iconClassName,
  className,
}: {
  icon: LucideIcon
  title: string
  children: ReactNode
  iconClassName: string
  className?: string
}) {
  return (
    <section
      className={`rounded-xl border border-brand-border bg-[#f8f7f5] p-3 shadow-sm ${className ?? ''}`}
    >
      <h3 className="mb-2.5 flex items-center gap-1.5 border-b border-brand-border/70 pb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-primary">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ${iconClassName}`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden strokeWidth={2.25} />
        </span>
        {title}
      </h3>
      {children}
    </section>
  )
}

function FieldLabel({
  icon: Icon,
  iconClassName,
  children,
}: {
  icon: LucideIcon
  iconClassName?: string
  children: ReactNode
}) {
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-brand-muted">
      <Icon
        className={`h-3 w-3 shrink-0 ${iconClassName ?? 'text-brand-muted'}`}
        aria-hidden
        strokeWidth={2.25}
      />
      {children}
    </span>
  )
}

function IconChip({
  active,
  onClick,
  icon: Icon,
  label,
  iconClassName,
  compact,
  multilineLabel,
}: {
  active: boolean
  onClick: () => void
  icon: LucideIcon
  label: string
  iconClassName?: string
  compact?: boolean
  multilineLabel?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border transition active:scale-[0.98] ${
        compact ? 'min-h-[3.25rem] px-1 py-1.5' : 'min-w-[4.25rem] px-2 py-2'
      } ${
        active
          ? 'border-brand-accent bg-brand-surface text-brand-primary ring-1 ring-brand-accent/35'
          : 'border-brand-border/80 bg-brand-surface text-brand-text'
      }`}
    >
      <Icon
        className={`shrink-0 ${compact ? 'h-4 w-4' : 'h-5 w-5'} ${iconClassName ?? (active ? 'text-brand-accent' : 'text-brand-muted')}`}
        aria-hidden
        strokeWidth={2}
      />
      <span
        className={`max-w-full text-center font-semibold leading-tight ${
          multilineLabel ? 'whitespace-normal text-[8px]' : 'truncate text-[9px]'
        }`}
      >
        {label}
      </span>
    </button>
  )
}

type Props = {
  profile: EditableProfile
  onSaved: () => void
  hideBanner?: boolean
  fileInputRef?: React.RefObject<HTMLInputElement | null>
  isAdmin?: boolean
}

export function ProfileDetailsForm({
  profile,
  onSaved,
  hideBanner = false,
  fileInputRef: fileInputRefProp,
  isAdmin = false,
}: Props) {
  const { t } = useTranslation()
  const localFileInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = fileInputRefProp ?? localFileInputRef
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null)
  const [playtomicNumber, setPlaytomicNumber] = useState(profile.playtomic_number ?? '')
  const [racket, setRacket] = useState(profile.racket ?? '')
  const [playStyles, setPlayStyles] = useState<PlayStyle[]>(() => parsePlayStyles(profile.play_style))
  const [preferredSide, setPreferredSide] = useState<PlaySide | null>(profile.preferred_side)
  const [enjoysFun, setEnjoysFun] = useState(profile.enjoys_fun_games ?? false)
  const [usuallyFree, setUsuallyFree] = useState(profile.usually_free ?? '')
  const [gender, setGender] = useState<PlayerGender | null>(
    PLAYER_GENDERS.includes(profile.gender as PlayerGender) ? (profile.gender as PlayerGender) : null,
  )
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(
    SKILL_LEVELS.includes(profile.skill_level as SkillLevel)
      ? (profile.skill_level as SkillLevel)
      : null,
  )
  const [dominantHand, setDominantHand] = useState<DominantHand | null>(profile.dominant_hand)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const pendingAvatarUrl = useMemo(
    () => (pendingAvatar ? URL.createObjectURL(pendingAvatar) : null),
    [pendingAvatar],
  )

  useEffect(() => {
    return () => {
      if (pendingAvatarUrl) URL.revokeObjectURL(pendingAvatarUrl)
    }
  }, [pendingAvatarUrl])

  const avatarPreview = pendingAvatarUrl ?? profile.avatar_url
  const avatarInitial = firstDisplayName(displayName).trim()[0]?.toUpperCase() ?? '?'

  useEffect(() => {
    setDisplayName(profile.display_name)
    setPendingAvatar(null)
    setPlaytomicNumber(profile.playtomic_number ?? '')
    setRacket(profile.racket ?? '')
    setPlayStyles(parsePlayStyles(profile.play_style))
    setPreferredSide(profile.preferred_side)
    setEnjoysFun(profile.enjoys_fun_games ?? false)
    setUsuallyFree(profile.usually_free ?? '')
    setGender(
      PLAYER_GENDERS.includes(profile.gender as PlayerGender)
        ? (profile.gender as PlayerGender)
        : null,
    )
    setSkillLevel(
      SKILL_LEVELS.includes(profile.skill_level as SkillLevel)
        ? (profile.skill_level as SkillLevel)
        : null,
    )
    setDominantHand(profile.dominant_hand)
  }, [profile])

  const onAvatarPick = (file: File | undefined) => {
    if (!file) return
    const validationError = validateProfileAvatar(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setPendingAvatar(file)
  }

  const save = async () => {
    const trimmedName = displayName.trim()
    if (!trimmedName) {
      setError(t('profile.displayNameRequired'))
      return
    }

    setBusy(true)
    setError(null)
    setSaved(false)

    let avatarUrl = profile.avatar_url
    if (pendingAvatar) {
      try {
        avatarUrl = await uploadProfileAvatar(profile.id, pendingAvatar)
      } catch (uploadErr) {
        setBusy(false)
        setError(uploadErr instanceof Error ? uploadErr.message : t('profile.photoUploadFailed'))
        return
      }
    }

    const payload: Record<string, unknown> = {
      display_name: trimmedName,
      avatar_url: avatarUrl,
      playtomic_number: playtomicNumber.trim() || null,
      racket: racket.trim() || null,
      play_style: serializePlayStyles(playStyles),
      preferred_side: preferredSide,
      enjoys_fun_games: enjoysFun,
      usually_free: usuallyFree.trim() || null,
    }
    if (isAdmin) {
      payload.gender = gender
      payload.skill_level = skillLevel
      payload.dominant_hand = dominantHand
    }

    const { error: err } = await supabase.from('profiles').update(payload).eq('id', profile.id)
    setBusy(false)
    if (err) setError(err.message)
    else {
      setPendingAvatar(null)
      setSaved(true)
      window.dispatchEvent(new Event('successpadel:profile-synced'))
      onSaved()
    }
  }

  return (
    <form
      className="flex flex-col gap-3 px-4 py-3 md:px-5"
      id="profile-edit"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      {!hideBanner && (
        <div className="mb-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative shrink-0"
            aria-label={t('profile.changePhoto')}
          >
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt=""
                className="h-14 w-14 rounded-full object-cover ring-2 ring-brand-border"
              />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-bg-alt text-lg font-semibold text-brand-muted ring-2 ring-brand-border">
                {avatarInitial}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-medium text-brand-accent"
          >
            {t('profile.changePhoto')}
          </button>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => onAvatarPick(e.target.files?.[0])}
      />

      <FormSection
        icon={User}
        title={t('playerProfile.details')}
        iconClassName="bg-brand-accent/15 text-brand-accent ring-brand-accent/35"
      >
        <div className="grid grid-cols-2 gap-2.5">
          <label className="col-span-2 block space-y-1 sm:col-span-1">
            <FieldLabel icon={User} iconClassName="text-brand-accent">
              {t('profile.displayName')}
            </FieldLabel>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('profile.displayNamePlaceholder')}
              className="brand-input bg-brand-surface py-2 text-sm"
              autoComplete="name"
            />
          </label>
          <label className="col-span-2 block space-y-1 sm:col-span-1">
            <FieldLabel icon={Hash} iconClassName="text-slate-500">
              {t('playerProfile.playtomic')}
            </FieldLabel>
            <input
              value={playtomicNumber}
              onChange={(e) => setPlaytomicNumber(e.target.value)}
              placeholder={t('playerProfile.playtomicPlaceholder')}
              className="brand-input bg-brand-surface py-2 text-sm"
              inputMode="numeric"
            />
          </label>
          <label className="col-span-2 block space-y-1">
            <FieldLabel icon={Zap} iconClassName="text-orange-600">
              {t('playerProfile.racket')}
            </FieldLabel>
            <input
              value={racket}
              onChange={(e) => setRacket(e.target.value)}
              placeholder={t('playerProfile.racketPlaceholder')}
              className="brand-input bg-brand-surface py-2 text-sm"
            />
          </label>
        </div>
      </FormSection>

      {isAdmin ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <FormSection
              icon={Venus}
              title={t('playerProfile.gender')}
              iconClassName="bg-fuchsia-100 text-fuchsia-600 ring-fuchsia-200"
            >
              <div className="grid grid-cols-2 gap-1.5">
                {PLAYER_GENDERS.map((g) => (
                  <IconChip
                    key={g}
                    compact
                    active={gender === g}
                    onClick={() => setGender(gender === g ? null : g)}
                    icon={GENDER_ICONS[g]}
                    iconClassName={GENDER_CHIP_COLORS[g]}
                    label={profileGenderLabel(g, t)}
                  />
                ))}
              </div>
            </FormSection>
            <FormSection
              icon={Hand}
              title={t('playerProfile.hand')}
              iconClassName="bg-sky-100 text-sky-600 ring-sky-200"
            >
              <div className="grid grid-cols-2 gap-1.5">
                {DOMINANT_HANDS.map((h) => (
                  <IconChip
                    key={h.value}
                    compact
                    active={dominantHand === h.value}
                    onClick={() => setDominantHand(dominantHand === h.value ? null : h.value)}
                    icon={Hand}
                    iconClassName={`${HAND_CHIP_COLORS[h.value]} ${h.value === 'left' ? '-scale-x-100' : ''}`}
                    label={profileHandLabel(h.value, t)}
                  />
                ))}
              </div>
            </FormSection>
          </div>
          <FormSection
            icon={Layers}
            title={t('playerProfile.level')}
            iconClassName="bg-amber-100 text-amber-700 ring-amber-200"
          >
            <div className="grid grid-cols-5 gap-1.5">
              {SKILL_LEVELS.map((level) => (
                <IconChip
                  key={level}
                  compact
                  active={skillLevel === level}
                  onClick={() => setSkillLevel(skillLevel === level ? null : level)}
                  icon={LEVEL_ICONS[level]}
                  iconClassName={LEVEL_CHIP_COLORS[level]}
                  label={profileSkillLabel(level, t)}
                  multilineLabel
                />
              ))}
            </div>
          </FormSection>
        </>
      ) : null}

      <FormSection
        icon={LayoutGrid}
        title={t('playerProfile.playStyle')}
        iconClassName="bg-violet-100 text-violet-600 ring-violet-200"
      >
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {PLAY_STYLES.map((style) => (
            <IconChip
              key={style}
              compact
              active={playStyles.includes(style)}
              onClick={() =>
                setPlayStyles((prev) =>
                  prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style],
                )
              }
              icon={STYLE_ICONS[style]}
              iconClassName={STYLE_CHIP_COLORS[style]}
              label={profilePlayStyleLabel(style, t)}
            />
          ))}
        </div>
      </FormSection>

      <div className="grid grid-cols-2 gap-3">
        <FormSection
          icon={Columns2}
          title={t('playerProfile.preferredSide')}
          iconClassName="bg-teal-100 text-teal-600 ring-teal-200"
        >
          <div className="grid grid-cols-3 gap-1.5">
            {PLAY_SIDES.map((s) => (
              <IconChip
                key={s.value}
                compact
                active={preferredSide === s.value}
                onClick={() => setPreferredSide(preferredSide === s.value ? null : s.value)}
                icon={SIDE_ICONS[s.value]}
                iconClassName={SIDE_CHIP_COLORS[s.value]}
                label={profileSideLabel(s.value, t)}
              />
            ))}
          </div>
        </FormSection>
        <FormSection
          icon={Smile}
          title={t('playerProfile.funGames')}
          iconClassName="bg-lime-100 text-lime-700 ring-lime-200"
        >
          <div className="grid grid-cols-2 gap-1.5">
            <IconChip
              compact
              active={enjoysFun}
              onClick={() => setEnjoysFun(true)}
              icon={Smile}
              iconClassName="text-lime-600"
              label={t('playerProfile.yes')}
            />
            <IconChip
              compact
              active={!enjoysFun}
              onClick={() => setEnjoysFun(false)}
              icon={ThumbsDown}
              iconClassName="text-stone-500"
              label={t('playerProfile.no')}
            />
          </div>
        </FormSection>
      </div>

      <FormSection
        icon={Activity}
        title={t('playerProfile.usuallyFree')}
        iconClassName="bg-orange-100 text-orange-600 ring-orange-200"
      >
        <textarea
          value={usuallyFree}
          onChange={(e) => setUsuallyFree(e.target.value)}
          placeholder={t('playerProfile.usuallyFreePlaceholder')}
          rows={2}
          className="brand-input w-full resize-none bg-brand-surface py-2 text-sm"
        />
      </FormSection>

      <div className="space-y-2 rounded-xl border border-brand-border bg-brand-surface p-3 shadow-sm">
        {error && <p className="text-xs text-red-600">{error}</p>}
        {saved && <p className="text-xs text-brand-accent">{t('playerProfile.adminSaved')}</p>}
        <button type="submit" disabled={busy} className="brand-btn w-full py-2.5 text-sm font-semibold">
          {busy ? t('common.loading') : t('playerProfile.save')}
        </button>
      </div>
    </form>
  )
}
