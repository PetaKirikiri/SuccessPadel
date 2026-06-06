import { useEffect, useState } from 'react'
import { parsePlayStyles, PLAY_SIDES, PLAY_STYLES, serializePlayStyles, type PlayStyle } from '../lib/profileFields'
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
}

export function ProfileDetailsForm({ profile, onSaved }: Props) {
  const [playtomicNumber, setPlaytomicNumber] = useState(profile.playtomic_number ?? '')
  const [racket, setRacket] = useState(profile.racket ?? '')
  const [playStyles, setPlayStyles] = useState<PlayStyle[]>(() => parsePlayStyles(profile.play_style))
  const [preferredSide, setPreferredSide] = useState<PlaySide | null>(profile.preferred_side)
  const [enjoysFun, setEnjoysFun] = useState(profile.enjoys_fun_games ?? false)
  const [usuallyFree, setUsuallyFree] = useState(profile.usually_free ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setPlaytomicNumber(profile.playtomic_number ?? '')
    setRacket(profile.racket ?? '')
    setPlayStyles(parsePlayStyles(profile.play_style))
    setPreferredSide(profile.preferred_side)
    setEnjoysFun(profile.enjoys_fun_games ?? false)
    setUsuallyFree(profile.usually_free ?? '')
  }, [profile])

  const save = async () => {
    setBusy(true)
    setError(null)
    setSaved(false)
    const { error: err } = await supabase
      .from('profiles')
      .update({
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
      setSaved(true)
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
