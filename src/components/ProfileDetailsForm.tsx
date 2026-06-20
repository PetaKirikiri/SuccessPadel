import { useEffect, useMemo, useRef, useState, useId } from 'react'
import { Activity, Columns2, Hash, Hand, Layers, LayoutGrid, Smile, ThumbsDown, User, Venus, Zap } from 'lucide-react'
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
import {
  GENDER_CHIP_COLORS,
  GENDER_ICONS,
  HAND_CHIP_COLORS,
  LEVEL_CHIP_COLORS,
  LEVEL_ICONS,
  ProfileFieldLabel,
  ProfileFormSection,
  ProfileIconChip,
  SIDE_CHIP_COLORS,
  SIDE_ICONS,
  STYLE_CHIP_COLORS,
  STYLE_ICONS,
} from './profileFormUi'

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
  const photoInputId = useId()
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
    if (hideBanner || !file) return
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
    if (!hideBanner && pendingAvatar) {
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
          <label
            htmlFor={photoInputId}
            className="relative shrink-0 cursor-pointer"
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
          </label>
          <label
            htmlFor={photoInputId}
            className="cursor-pointer text-xs font-medium text-brand-accent"
          >
            {t('profile.changePhoto')}
          </label>
        </div>
      )}
      {!hideBanner ? (
        <input
          id={photoInputId}
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => onAvatarPick(e.target.files?.[0])}
        />
      ) : null}

      <ProfileFormSection
        icon={User}
        title={t('playerProfile.details')}
        iconClassName="bg-brand-accent/15 text-brand-accent ring-brand-accent/35"
      >
        <div className="grid grid-cols-2 gap-2.5">
          <label className="col-span-2 block space-y-1 sm:col-span-1">
            <ProfileFieldLabel icon={User} iconClassName="text-brand-accent">
              {t('profile.displayName')}
            </ProfileFieldLabel>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('profile.displayNamePlaceholder')}
              className="brand-input bg-brand-surface py-2 text-sm"
              autoComplete="name"
            />
          </label>
          <label className="col-span-2 block space-y-1 sm:col-span-1">
            <ProfileFieldLabel icon={Hash} iconClassName="text-slate-500">
              {t('playerProfile.playtomic')}
            </ProfileFieldLabel>
            <input
              value={playtomicNumber}
              onChange={(e) => setPlaytomicNumber(e.target.value)}
              placeholder={t('playerProfile.playtomicPlaceholder')}
              className="brand-input bg-brand-surface py-2 text-sm"
              inputMode="numeric"
            />
          </label>
          <label className="col-span-2 block space-y-1">
            <ProfileFieldLabel icon={Zap} iconClassName="text-orange-600">
              {t('playerProfile.racket')}
            </ProfileFieldLabel>
            <input
              value={racket}
              onChange={(e) => setRacket(e.target.value)}
              placeholder={t('playerProfile.racketPlaceholder')}
              className="brand-input bg-brand-surface py-2 text-sm"
            />
          </label>
        </div>
      </ProfileFormSection>

      {isAdmin ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <ProfileFormSection
              icon={Venus}
              title={t('playerProfile.gender')}
              iconClassName="bg-fuchsia-100 text-fuchsia-600 ring-fuchsia-200"
            >
              <div className="grid grid-cols-2 gap-1.5">
                {PLAYER_GENDERS.map((g) => (
                  <ProfileIconChip
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
            </ProfileFormSection>
            <ProfileFormSection
              icon={Hand}
              title={t('playerProfile.hand')}
              iconClassName="bg-sky-100 text-sky-600 ring-sky-200"
            >
              <div className="grid grid-cols-2 gap-1.5">
                {DOMINANT_HANDS.map((h) => (
                  <ProfileIconChip
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
            </ProfileFormSection>
          </div>
          <ProfileFormSection
            icon={Layers}
            title={t('playerProfile.level')}
            iconClassName="bg-amber-100 text-amber-700 ring-amber-200"
          >
            <div className="grid grid-cols-5 gap-1.5">
              {SKILL_LEVELS.map((level) => (
                <ProfileIconChip
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
          </ProfileFormSection>
        </>
      ) : null}

      <ProfileFormSection
        icon={LayoutGrid}
        title={t('playerProfile.playStyle')}
        iconClassName="bg-violet-100 text-violet-600 ring-violet-200"
      >
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {PLAY_STYLES.map((style) => (
            <ProfileIconChip
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
      </ProfileFormSection>

      <div className="grid grid-cols-2 gap-3">
        <ProfileFormSection
          icon={Columns2}
          title={t('playerProfile.preferredSide')}
          iconClassName="bg-teal-100 text-teal-600 ring-teal-200"
        >
          <div className="grid grid-cols-3 gap-1.5">
            {PLAY_SIDES.map((s) => (
              <ProfileIconChip
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
        </ProfileFormSection>
        <ProfileFormSection
          icon={Smile}
          title={t('playerProfile.funGames')}
          iconClassName="bg-lime-100 text-lime-700 ring-lime-200"
        >
          <div className="grid grid-cols-2 gap-1.5">
            <ProfileIconChip
              compact
              active={enjoysFun}
              onClick={() => setEnjoysFun(true)}
              icon={Smile}
              iconClassName="text-lime-600"
              label={t('playerProfile.yes')}
            />
            <ProfileIconChip
              compact
              active={!enjoysFun}
              onClick={() => setEnjoysFun(false)}
              icon={ThumbsDown}
              iconClassName="text-stone-500"
              label={t('playerProfile.no')}
            />
          </div>
        </ProfileFormSection>
      </div>

      <ProfileFormSection
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
      </ProfileFormSection>

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
