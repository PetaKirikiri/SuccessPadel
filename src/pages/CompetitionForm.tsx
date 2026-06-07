import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AMERICANO_DEFAULT_TARGET,
  AMERICANO_TARGETS,
  type AmericanoScoringChoice,
  americanoScoringFromConfig,
  americanoTargetLabel,
  buildAmericanoScoringConfig,
  buildCompetitionTitle,
  buildRulesText,
  DURATIONS,
  GENDERS,
  partnerStyleLabel,
  partnershipModeToRules,
  PLAYER_CAPS,
  ruleFormatLabel,
  rulesToPartnershipMode,
  RULE_FORMATS,
  PARTNER_STYLES,
  SKILL_LEVELS,
  type Gender,
  type PartnerStyle,
  type RuleFormat,
  type SkillLevel,
} from '../lib/competitionPresets'
import {
  formatDateInput,
  formatHourLabel,
  maxDurationFromStart,
  scheduleGridHours,
  toIsoTimestamp,
} from '../lib/courtSchedule'
import { useAuth } from '../hooks/useAuth'
import {
  AMERICANO_GAME_COUNTS,
  americanoGamesFromConfig,
  breakMinutesFromConfig,
  BREAK_MINUTE_OPTIONS,
  eventScheduleSummary,
  gameDurationForEvent,
} from '../lib/competitionLayout'
import { supabase } from '../lib/supabaseClient'
import type { GameSession } from '../lib/types'

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

function bangkokDateFromIso(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date(iso))
}

export function CompetitionForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [day, setDay] = useState(formatDateInput(new Date()))
  const [startHour, setStartHour] = useState(18)
  const [duration, setDuration] = useState(2)
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('Low Inter')
  const [gender, setGender] = useState<Gender>('Mixed')
  const [targetPlayers, setTargetPlayers] = useState<4 | 8 | 12 | 16>(8)
  const [ruleFormat, setRuleFormat] = useState<RuleFormat>('king_of_court')
  const [partnerStyle, setPartnerStyle] = useState<PartnerStyle>('swapped')
  const [americanoScoring, setAmericanoScoring] = useState<AmericanoScoringChoice>(
    AMERICANO_DEFAULT_TARGET,
  )
  const [gameCount, setGameCount] = useState<(typeof AMERICANO_GAME_COUNTS)[number]>(7)
  const [breakMinutes, setBreakMinutes] = useState<(typeof BREAK_MINUTE_OPTIONS)[number]>(3)
  const [title, setTitle] = useState('')
  const [seasonId, setSeasonId] = useState('')
  const [seasonLoading, setSeasonLoading] = useState(true)
  const [seasonError, setSeasonError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hours = scheduleGridHours()
  const maxDuration = useMemo(() => Math.min(3, maxDurationFromStart(startHour)), [startHour])
  const schedulePreview = useMemo(() => {
    if (ruleFormat !== 'americano') return null
    const startsAtIso = toIsoTimestamp(day, startHour)
    const startsAt = new Date(startsAtIso)
    const endsAt = new Date(startsAt.getTime() + duration * 60 * 60 * 1000)
    const eventMinutes = duration * 60
    const playMinutes = gameDurationForEvent(eventMinutes, gameCount, breakMinutes)
    return {
      summary: eventScheduleSummary(startsAtIso, endsAt.toISOString(), gameCount, breakMinutes),
      playMinutes,
    }
  }, [ruleFormat, day, startHour, duration, gameCount, breakMinutes])

  useEffect(() => {
    if (duration > maxDuration) setDuration(maxDuration)
  }, [duration, maxDuration])

  useEffect(() => {
    setSeasonLoading(true)
    setSeasonError(null)
    void supabase
      .from('seasons')
      .select('id')
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data, error: seasonQueryError }) => {
        if (seasonQueryError) {
          setSeasonError(seasonQueryError.message)
        } else if (!data?.id) {
          setSeasonError('No active season.')
        } else {
          setSeasonId(data.id)
        }
        setSeasonLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!id) return
    void supabase
      .from('game_sessions')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        const g = data as GameSession | null
        if (!g) return
        if (g.season_id) setSeasonId(g.season_id)
        if (g.skill_level && SKILL_LEVELS.includes(g.skill_level as SkillLevel)) {
          setSkillLevel(g.skill_level as SkillLevel)
        }
        if (g.gender && GENDERS.includes(g.gender as Gender)) {
          setGender(g.gender as Gender)
        }
        const parsed = partnershipModeToRules(g.partnership_mode, g.rules)
        setRuleFormat(parsed.format)
        if (parsed.partners) setPartnerStyle(parsed.partners)
        setTitle(g.title)
        const cap = g.target_players ?? g.max_players
        if (cap && PLAYER_CAPS.includes(cap as 4 | 8 | 12 | 16)) {
          setTargetPlayers(cap as 4 | 8 | 12 | 16)
        }
        setAmericanoScoring(americanoScoringFromConfig(g.scoring_config))
        const savedGames = americanoGamesFromConfig(g.scoring_config)
        if (AMERICANO_GAME_COUNTS.includes(savedGames as (typeof AMERICANO_GAME_COUNTS)[number])) {
          setGameCount(savedGames as (typeof AMERICANO_GAME_COUNTS)[number])
        }
        const savedBreak = breakMinutesFromConfig(g.scoring_config)
        if (BREAK_MINUTE_OPTIONS.includes(savedBreak as (typeof BREAK_MINUTE_OPTIONS)[number])) {
          setBreakMinutes(savedBreak as (typeof BREAK_MINUTE_OPTIONS)[number])
        }
        if (g.starts_at) {
          setDay(bangkokDateFromIso(g.starts_at))
          setStartHour(
            parseInt(
              new Intl.DateTimeFormat('en-GB', {
                hour: 'numeric',
                hour12: false,
                timeZone: 'Asia/Bangkok',
              }).format(new Date(g.starts_at)),
              10,
            ),
          )
          if (g.ends_at) {
            const startMs = new Date(g.starts_at).getTime()
            const endMs = new Date(g.ends_at).getTime()
            const hrs = Math.round((endMs - startMs) / (60 * 60 * 1000))
            if (hrs >= 1 && hrs <= 3) setDuration(hrs)
          }
        } else if (g.starts_on) {
          setDay(g.starts_on)
        }
      })
  }, [id])

  const save = async () => {
    if (!seasonId) {
      setError('No active season.')
      return
    }
    setBusy(true)
    setError(null)

    const startsAtIso = toIsoTimestamp(day, startHour)
    const startsAt = new Date(startsAtIso)
    const endsAt = new Date(startsAt.getTime() + duration * 60 * 60 * 1000)
    const finalTitle = buildCompetitionTitle(skillLevel, startsAt, title)
    const partners = ruleFormat === 'americano' ? null : partnerStyle
    const partnershipMode = rulesToPartnershipMode(ruleFormat, partners)
    const americanoConfig =
      ruleFormat === 'americano'
        ? buildAmericanoScoringConfig(americanoScoring, { games: gameCount, breakMinutes })
        : null

    const payload = {
      season_id: seasonId,
      title: finalTitle,
      starts_on: day,
      ends_on: bangkokDateFromIso(endsAt.toISOString()),
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: 'open' as const,
      game_kind: 'competition' as const,
      visibility: 'open' as const,
      skill_level: skillLevel,
      gender,
      rules: buildRulesText(
        ruleFormat,
        partners,
        americanoConfig
          ? {
              target: americanoConfig.americano_target,
              unit: americanoConfig.americano_unit ?? 'points',
            }
          : undefined,
      ),
      target_players: targetPlayers,
      max_players: targetPlayers,
      player_cap_mode: 'strict' as const,
      partnership_mode: partnershipMode,
      scoring_preset: 'standard' as const,
      scoring_config: americanoConfig ?? {},
      who_can_log_matches: 'roster_members' as const,
      margin_bonus_enabled: true,
      created_by: user?.id ?? null,
    }

    const { error: err } = id
      ? await supabase.from('game_sessions').update(payload).eq('id', id)
      : await supabase.from('game_sessions').insert(payload).select('id').single()

    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    navigate('/competitions')
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div data-scroll-y className="scroll-y min-h-0 flex-1 space-y-3 pb-24">
        <div className="flex items-center justify-between">
          <Link to="/competitions" className="text-sm font-medium text-brand-accent">
            ← Back
          </Link>
        </div>

        <section className="game-card space-y-3">
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Day</span>
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="brand-input"
            />
          </label>

          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Start</span>
            <div className="flex flex-wrap gap-1.5">
              {hours.map((h) => (
                <Chip key={h} active={startHour === h} onClick={() => setStartHour(h)}>
                  {formatHourLabel(h)}
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Hours</span>
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.filter((h) => h <= maxDuration).map((h) => (
                <Chip key={h} active={duration === h} onClick={() => setDuration(h)}>
                  {h}h
                </Chip>
              ))}
            </div>
          </div>
        </section>

        <section className="game-card space-y-3">
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Level</span>
            <div className="flex flex-wrap gap-1.5">
              {SKILL_LEVELS.map((level) => (
                <Chip key={level} active={skillLevel === level} onClick={() => setSkillLevel(level)}>
                  {level}
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Gender</span>
            <div className="flex flex-wrap gap-1.5">
              {GENDERS.map((g) => (
                <Chip key={g} active={gender === g} onClick={() => setGender(g)}>
                  {g}
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Spots</span>
            <div className="flex flex-wrap gap-1.5">
              {PLAYER_CAPS.map((n) => (
                <Chip key={n} active={targetPlayers === n} onClick={() => setTargetPlayers(n)}>
                  {n}
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Rules</span>
            <div className="flex flex-wrap gap-1.5">
              {RULE_FORMATS.map((format) => (
                <Chip
                  key={format}
                  active={ruleFormat === format}
                  onClick={() => setRuleFormat(format)}
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
                  {AMERICANO_TARGETS.map((n) => (
                    <Chip
                      key={n}
                      active={americanoScoring === n}
                      onClick={() => setAmericanoScoring(n)}
                    >
                      {americanoTargetLabel(n)}
                    </Chip>
                  ))}
                  <Chip
                    active={americanoScoring === 'open'}
                    onClick={() => setAmericanoScoring('open')}
                  >
                    Open
                  </Chip>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                  Games
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {AMERICANO_GAME_COUNTS.map((n) => (
                    <Chip key={n} active={gameCount === n} onClick={() => setGameCount(n)}>
                      {n}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                  Break between games
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {BREAK_MINUTE_OPTIONS.map((n) => (
                    <Chip key={n} active={breakMinutes === n} onClick={() => setBreakMinutes(n)}>
                      {n} min
                    </Chip>
                  ))}
                </div>
              </div>

              {schedulePreview && (
                <p className="text-xs leading-relaxed text-brand-muted">
                  {schedulePreview.summary}
                  {schedulePreview.playMinutes < 12 && (
                    <span className="mt-1 block text-amber-700">
                      Games may feel rushed — try fewer games or a longer session.
                    </span>
                  )}
                </p>
              )}
            </>
          )}

          {ruleFormat === 'king_of_court' && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Partners</span>
              <div className="flex flex-wrap gap-1.5">
                {PARTNER_STYLES.map((style) => (
                  <Chip
                    key={style}
                    active={partnerStyle === style}
                    onClick={() => setPartnerStyle(style)}
                  >
                    {partnerStyleLabel(style)}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Name</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Auto from level + date + time"
              className="brand-input"
            />
          </label>
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 border-t border-brand-border bg-brand-surface/95 px-4 py-3 backdrop-blur-md">
        {(seasonError || error) && (
          <p className="mb-2 text-center text-xs text-red-600">{error ?? seasonError}</p>
        )}
        <button
          type="button"
          disabled={busy || seasonLoading || !seasonId}
          onClick={() => void save()}
          className="brand-btn w-full text-sm font-semibold disabled:opacity-50"
        >
          {busy ? 'Saving…' : seasonLoading ? 'Loading…' : id ? 'Save' : 'Add'}
        </button>
      </div>
    </div>
  )
}
