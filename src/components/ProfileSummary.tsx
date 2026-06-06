import { playSideLabel } from '../lib/profileFields'
import type { Profile } from '../lib/types'

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 text-brand-muted">{label}</span>
      <span className="min-w-0 text-brand-text">{value?.trim() || '—'}</span>
    </div>
  )
}

export function ProfileSummary({ profile }: { profile: Profile }) {
  return (
    <div className="game-card space-y-2">
      <Row label="Racket" value={profile.racket} />
      <Row label="Style" value={profile.play_style} />
      <Row label="Side" value={playSideLabel(profile.preferred_side)} />
      <Row label="Fun games" value={profile.enjoys_fun_games ? 'Yes' : 'No'} />
      <Row label="Usually free" value={profile.usually_free} />
    </div>
  )
}
