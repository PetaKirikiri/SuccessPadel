import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDateInput, formatHourLabel } from '../lib/courtSchedule'
import { competitionPlayerMode } from '../lib/competitionFormatPresets'
import {
  competitionStartsAtAnchorIso,
  parseCompetitionStartSlotValue,
  scheduleCompetitionStartSlots,
  type CompetitionPlayStartMinute,
} from '../lib/competitionLayout'
import type { CompetitionRow } from '../hooks/useCompetitions'
import { useTranslation } from '../hooks/useTranslation'
import { supabase } from '../lib/supabaseClient'
import type { ScoringConfig } from '../lib/types'

type Props = {
  rows: CompetitionRow[]
  isAdmin: boolean
  onRefresh: () => void
}

type LeagueGroup = {
  leagueId: string
  title: string
  weeks: CompetitionRow[]
}

function leagueTitleFromRow(row: CompetitionRow): string {
  return row.title.replace(/\s·\sWeek\s\d+$/, '')
}

export function DuoLeaguePanel({ rows, isAdmin, onRefresh }: Props) {
  const { t } = useTranslation()
  const [busyWeekId, setBusyWeekId] = useState<string | null>(null)
  const [weekDrafts, setWeekDrafts] = useState<
    Record<string, { day: string; hour: number; minute: CompetitionPlayStartMinute }>
  >({})

  const leagues = useMemo(() => {
    const map = new Map<string, LeagueGroup>()
    for (const row of rows) {
      if (row.game_group_id && competitionPlayerMode(row.scoring_config as ScoringConfig) === 'duos') {
        const existing = map.get(row.game_group_id)
        if (existing) {
          existing.weeks.push(row)
        } else {
          map.set(row.game_group_id, {
            leagueId: row.game_group_id,
            title: leagueTitleFromRow(row),
            weeks: [row],
          })
        }
      }
    }
    for (const group of map.values()) {
      group.weeks.sort((a, b) => (a.week_number ?? 0) - (b.week_number ?? 0))
    }
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title))
  }, [rows])

  if (leagues.length === 0) return null

  const saveWeekSchedule = async (row: CompetitionRow) => {
    const draft = weekDrafts[row.id] ?? {
      day: formatDateInput(new Date()),
      hour: 18,
      minute: 4 as CompetitionPlayStartMinute,
    }
    setBusyWeekId(row.id)
    const startsAt = new Date(
      competitionStartsAtAnchorIso(draft.day, draft.hour, draft.minute),
    )
    const eventMinutes = 116
    const endsAt = new Date(startsAt.getTime() + eventMinutes * 60 * 1000)
    const { error } = await supabase.rpc('update_league_week_schedule', {
      p_session_id: row.id,
      p_starts_at: startsAt.toISOString(),
      p_ends_at: endsAt.toISOString(),
    })
    setBusyWeekId(null)
    if (!error) onRefresh()
  }

  return (
    <section className="game-card space-y-3">
      <h2 className="text-sm font-semibold text-brand-text">{t('competition.duoLeagues')}</h2>
      {leagues.map((league) => (
        <div key={league.leagueId} className="rounded-xl border border-brand-border/50 p-3">
          <p className="font-medium text-brand-text">{league.title}</p>
          <ul className="mt-2 space-y-2">
            {league.weeks.map((week) => {
              const draft = weekDrafts[week.id] ?? {
                day: week.starts_on ?? formatDateInput(new Date()),
                hour: 18,
                minute: 4 as CompetitionPlayStartMinute,
              }
              return (
                <li key={week.id} className="rounded-lg bg-brand-bg-alt/60 p-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {t('competition.leagueWeek', { n: week.week_number ?? '?' })}
                    </span>
                    <span className="text-xs text-brand-muted">{week.status}</span>
                  </div>
                  {isAdmin && !week.starts_at ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={draft.day}
                        onChange={(e) =>
                          setWeekDrafts((prev) => ({
                            ...prev,
                            [week.id]: { ...draft, day: e.target.value },
                          }))
                        }
                        className="brand-input h-9 text-xs"
                      />
                      <select
                        value={formatHourLabel(draft.hour, draft.minute)}
                        onChange={(e) => {
                          const { hour, minute } = parseCompetitionStartSlotValue(e.target.value)
                          setWeekDrafts((prev) => ({
                            ...prev,
                            [week.id]: { ...draft, hour, minute },
                          }))
                        }}
                        className="brand-input h-9 text-xs"
                      >
                        {scheduleCompetitionStartSlots().map((slot) => (
                          <option key={slot.label} value={slot.label}>
                            {slot.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busyWeekId === week.id}
                        onClick={() => void saveWeekSchedule(week)}
                        className="brand-btn col-span-2 py-1.5 text-xs font-semibold disabled:opacity-50"
                      >
                        {t('competition.setWeekSchedule')}
                      </button>
                    </div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <Link to={`/competitions/${week.id}/edit`} className="text-brand-accent">
                      {t('competition.edit')}
                    </Link>
                    {week.starts_at ? (
                      <>
                        <Link to={`/competitions/${week.id}`} className="text-brand-accent">
                          {t('competition.reviewScores')}
                        </Link>
                        <Link to={`/competitions/${week.id}`} className="text-brand-accent">
                          {t('competition.play')}
                        </Link>
                      </>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}
