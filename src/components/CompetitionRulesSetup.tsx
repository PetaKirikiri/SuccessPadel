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
import { GameScheduleSetup } from './GameScheduleSetup'

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

          <GameScheduleSetup
            value={{ gameCount, gameMinutes, breakMinutes }}
            onChange={onChange}
          />

          {eventMinutes != null && (
            <p className="text-xs text-brand-muted tabular-nums">
              Event window: {eventMinutes} min
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
