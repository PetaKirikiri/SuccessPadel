import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '../hooks/useTranslation'
import { uploadProfileAvatar, validateProfileAvatar } from '../lib/profileAvatar'
import { parsePlayStyles, PLAY_SIDES, PLAY_STYLES, serializePlayStyles, type PlayStyle } from '../lib/profileFields'
import { firstDisplayName } from '../lib/leaderboardEntries'
import { supabase } from '../lib/supabaseClient'
import type { PlaySide, Profile } from '../lib/types'

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
        active
          ? 'bg-brand-accent text-white shadow-sm'
          : 'border border-brand-border bg-brand-surface text-brand-text'
      }`}
    >
      {children}
    </button>
  )
}

type Props = {
  profile: Profile
  onSaved: () => void
  hideBanner?: boolean
  fileInputRef?: React.RefObject<HTMLInputElement | null>
}

export function ProfileDetailsForm({ profile, onSaved, hideBanner = false, fileInputRef: fileInputRefProp }: Props) {
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

    const { error: err } = await supabase
      .from('profiles')
      .update({
        display_name: trimmedName,
        avatar_url: avatarUrl,
        playtomic_number: playtomicNumber.trim() || null,
        racket: racket.trim() || null,
        play_style: serializePlayStyles(playStyles),
        preferred_side: preferredSide,
        enjoys_fun_games: enjoysFun,
        usually_free: usuallyFree.trim() || null,
      })
      .eq('id', profile.id)
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
      className="space-y-3"
      id="profile-edit"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      {!hideBanner && (
        <div className="game-card flex items-center gap-3">
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
                className="h-16 w-16 rounded-full object-cover ring-2 ring-brand-border md:h-20 md:w-20"
              />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-bg-alt text-xl font-semibold text-brand-muted ring-2 ring-brand-border md:h-20 md:w-20">
                {avatarInitial}
              </span>
            )}
          </button>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-brand-primary">{firstDisplayName(displayName)}</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-medium text-brand-accent"
            >
              {t('profile.changePhoto')}
            </button>
          </div>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => onAvatarPick(e.target.files?.[0])}
      />

      <label className="block space-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
          {t('profile.displayName')}
        </span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t('profile.displayNamePlaceholder')}
          className="brand-input"
          autoComplete="name"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Playtomic #</span>
        <input
          value={playtomicNumber}
          onChange={(e) => setPlaytomicNumber(e.target.value)}
          placeholder="Your Playtomic player number"
          className="brand-input"
          inputMode="numeric"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Racket</span>
        <input
          value={racket}
          onChange={(e) => setRacket(e.target.value)}
          placeholder="e.g. Bullpadel Vertex 04"
          className="brand-input"
        />
      </label>

      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Play style</span>
        <div className="flex flex-wrap gap-1.5">
          {PLAY_STYLES.map((style) => (
            <Chip
              key={style}
              active={playStyles.includes(style)}
              onClick={() =>
                setPlayStyles((prev) =>
                  prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style],
                )
              }
            >
              {style}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Preferred side</span>
        <div className="flex flex-wrap gap-1.5">
          {PLAY_SIDES.map((s) => (
            <Chip
              key={s.value}
              active={preferredSide === s.value}
              onClick={() => setPreferredSide(preferredSide === s.value ? null : s.value)}
            >
              {s.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Fun games</span>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={enjoysFun} onClick={() => setEnjoysFun(true)}>
            Yes
          </Chip>
          <Chip active={!enjoysFun} onClick={() => setEnjoysFun(false)}>
            No
          </Chip>
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Usually free</span>
        <textarea
          value={usuallyFree}
          onChange={(e) => setUsuallyFree(e.target.value)}
          placeholder="e.g. weekday evenings, Sat mornings"
          rows={2}
          className="brand-input resize-none"
        />
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {saved && <p className="text-xs text-brand-accent">Saved</p>}

      <button type="submit" disabled={busy} className="brand-btn w-full py-2">
        {busy ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  )
}
