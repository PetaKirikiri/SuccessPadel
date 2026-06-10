import {
  AMERICANO_TARGETS,
  type AmericanoScoringChoice,
  americanoTargetLabel,
  PARTNER_STYLES,
  partnerStyleLabel,
  RULE_FORMATS,
  ruleFormatLabel,
  type PartnerStyle,
  type RuleFormat,
} from '../lib/competitionPresets'
import { totalScheduleMinutes } from '../lib/competitionLayout'
import { useEffect, useState, type ChangeEvent } from 'react'

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

function ScheduleNumberInput({
  label,
  value,
  min,
  max,
  fallback,
  onCommit,
}: {
  label: string
  value: number
  min: number
  max: number
  fallback: number
  onCommit: (n: number) => void
}) {
  const [text, setText] = useState(String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(String(value))
  }, [value, focused])

  const commit = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) {
      setText(String(value))
      return
    }
    const next = clampInt(trimmed, min, max, fallback)
    onCommit(next)
    setText(String(next))
  }

  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
        {label}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        value={text}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          commit(text)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        className="brand-input"
      />
    </label>
  )
}

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

export type CompetitionRulesSetupValues = {
  ruleFormat: RuleFormat
  partnerStyle: PartnerStyle
  americanoScoring: AmericanoScoringChoice
  gameCount: number
  gameMinutes: number
  breakMinutes: number
}

type Props = {
  value: CompetitionRulesSetupValues
  onChange: (patch: Partial<CompetitionRulesSetupValues>) => void
  eventMinutes?: number
}

export function CompetitionRulesSetup({ value, onChange, eventMinutes }: Props) {
  const { ruleFormat, partnerStyle, americanoScoring, gameCount, gameMinutes, breakMinutes } = value

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
          Rules
        </span>
        <div className="flex flex-wrap gap-1.5">
          {RULE_FORMATS.map((format) => (
            <Chip
              key={format}
              active={ruleFormat === format}
              onClick={() => onChange({ ruleFormat: format })}
            >
              {ruleFormatLabel(format)}
            </Chip>
          ))}
        </div>
      </div>

      {ruleFormat === 'americano' && (
        <>
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
              Scoring
            </span>
            <div className="flex flex-wrap gap-1.5">
              <Chip
                active={americanoScoring === 'open'}
                onClick={() => onChange({ americanoScoring: 'open' })}
              >
                Open
              </Chip>
              {AMERICANO_TARGETS.map((n) => (
                <Chip
                  key={n}
                  active={americanoScoring === n}
                  onClick={() => onChange({ americanoScoring: n })}
                >
                  {americanoTargetLabel(n)}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <ScheduleNumberInput
              label="Games"
              value={gameCount}
              min={5}
              max={11}
              fallback={7}
              onCommit={(gameCount) => onChange({ gameCount })}
            />
            <ScheduleNumberInput
              label="Game time (min)"
              value={gameMinutes}
              min={8}
              max={30}
              fallback={14}
              onCommit={(gameMinutes) => onChange({ gameMinutes })}
            />
            <ScheduleNumberInput
              label="Rest (min)"
              value={breakMinutes}
              min={1}
              max={10}
              fallback={3}
              onCommit={(breakMinutes) => onChange({ breakMinutes })}
            />
          </div>

          {eventMinutes != null && (
            <p className="text-xs text-brand-muted tabular-nums">
              Uses {totalScheduleMinutes(gameCount, gameMinutes, breakMinutes)} / {eventMinutes} min
            </p>
          )}
        </>
      )}

      {ruleFormat === 'king_of_court' && (
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
            Partners
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PARTNER_STYLES.map((style) => (
              <Chip
                key={style}
                active={partnerStyle === style}
                onClick={() => onChange({ partnerStyle: style })}
              >
                {partnerStyleLabel(style)}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
