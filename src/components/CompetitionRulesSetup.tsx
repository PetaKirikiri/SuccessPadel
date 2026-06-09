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
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                Games
              </span>
              <input
                type="number"
                min={5}
                max={11}
                value={gameCount}
                onChange={(e) =>
                  onChange({
                    gameCount: Math.max(5, Math.min(11, Number(e.target.value) || 7)),
                  })
                }
                className="brand-input"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                Game time (min)
              </span>
              <input
                type="number"
                min={8}
                max={30}
                value={gameMinutes}
                onChange={(e) =>
                  onChange({
                    gameMinutes: Math.max(8, Math.min(30, Number(e.target.value) || 14)),
                  })
                }
                className="brand-input"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                Rest (min)
              </span>
              <input
                type="number"
                min={1}
                max={10}
                value={breakMinutes}
                onChange={(e) =>
                  onChange({
                    breakMinutes: Math.max(1, Math.min(10, Number(e.target.value) || 3)),
                  })
                }
                className="brand-input"
              />
            </label>
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
