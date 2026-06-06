import type { ScoringPreset } from '../lib/types'

const PRESETS: { id: ScoringPreset; label: string }[] = [
  { id: 'standard', label: 'Standard (3 win / 1 loss)' },
  { id: 'participation', label: 'Participation (1 per match)' },
  { id: 'winner_takes_all', label: 'Winner takes all (4/0)' },
  { id: 'custom', label: 'Custom' },
]

type Props = {
  value: ScoringPreset
  onChange: (v: ScoringPreset) => void
  marginBonus: boolean
  onMarginBonusChange: (v: boolean) => void
  customWin?: number
  customLoss?: number
  onCustomWin?: (n: number) => void
  onCustomLoss?: (n: number) => void
}

export function ScoringPresetPicker({
  value,
  onChange,
  marginBonus,
  onMarginBonusChange,
  customWin = 3,
  customLoss = 1,
  onCustomWin,
  onCustomLoss,
}: Props) {
  return (
    <div className="space-y-3">
      {PRESETS.map((p) => (
        <label key={p.id} className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="scoring"
            checked={value === p.id}
            onChange={() => onChange(p.id)}
            className="accent-brand-accent"
          />
          <span className="text-sm">{p.label}</span>
        </label>
      ))}
      {value === 'standard' && (
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <input
            type="checkbox"
            checked={marginBonus}
            onChange={(e) => onMarginBonusChange(e.target.checked)}
            className="accent-brand-accent"
          />
          Margin bonus (+1 for 6-0 / 6-1 set)
        </label>
      )}
      {value === 'custom' && (
        <div className="flex gap-2">
          <input
            type="number"
            aria-label="Win points"
            value={customWin}
            onChange={(e) => onCustomWin?.(Number(e.target.value))}
            className="w-20 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm"
          />
          <input
            type="number"
            aria-label="Loss points"
            value={customLoss}
            onChange={(e) => onCustomLoss?.(Number(e.target.value))}
            className="w-20 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm"
          />
        </div>
      )}
    </div>
  )
}
