import { useMemo, useState } from 'react'
import { CompetitionSchedulePreview } from './CompetitionSchedulePreview'
import { SessionTimeSetup } from './SessionTimeSetup'
import { useTranslation } from '../hooks/useTranslation'
import {
  bangkokNow,
  clubHourToDate,
  formatClubTime,
  formatHourLabel,
  roundToSessionStartMinute,
  toIsoTimestamp,
} from '../lib/courtSchedule'
import {
  fitFriendlyScheduleToRemaining,
  friendlyConfigWithSessionEnd,
  friendlyFilledSlots,
  friendlyMaxGameCountForPlayers,
  friendlyPlayMinutesUntilSessionEnd,
  friendlySessionEndAt,
  type FriendlyGameRecord,
  type FriendlyOrganizedConfig,
} from '../lib/friendlyGames'
import { updateFriendlySession } from '../lib/friendlyServer'

type Props = {
  game: FriendlyGameRecord
  config: FriendlyOrganizedConfig
  onUpdated: () => void | Promise<void>
}

export function FriendlyLateStartPanel({ game, config, onUpdated }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [day, setDay] = useState(config.day)
  const [startHour, setStartHour] = useState(config.startHour)
  const [startMinute, setStartMinute] = useState(config.startMinute ?? 0)
  const [breakMinutes, setBreakMinutes] = useState(config.breakMinutes)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const anchored = useMemo(() => friendlyConfigWithSessionEnd(config), [config])
  const sessionEnd = useMemo(() => friendlySessionEndAt(anchored), [anchored])
  const playerCount = friendlyFilledSlots(game)

  const preview = useMemo(() => {
    if (!sessionEnd) return null
    const gameStart = clubHourToDate(day, startHour, startMinute)
    const playMinutes = friendlyPlayMinutesUntilSessionEnd(anchored, gameStart)
    if (playMinutes == null) return null
    const maxGames = friendlyMaxGameCountForPlayers(playerCount)
    const fit = fitFriendlyScheduleToRemaining(playMinutes, breakMinutes, maxGames)
    const startsAtIso = toIsoTimestamp(day, startHour, startMinute)
    const eventMinutes = playMinutes
    return { playMinutes, fit, startsAtIso, eventMinutes }
  }, [anchored, breakMinutes, day, playerCount, sessionEnd, startHour, startMinute])

  const applyNow = () => {
    const now = bangkokNow()
    setDay(now.day)
    setStartHour(now.hour)
    setStartMinute(roundToSessionStartMinute(now.minute))
  }

  const apply = async () => {
    if (!preview?.fit.fits) return
    setBusy(true)
    setError(null)
    const next: FriendlyOrganizedConfig = {
      ...anchored,
      day,
      startHour,
      startMinute,
      breakMinutes,
      gameCount: preview.fit.gameCount,
      gameMinutes: preview.fit.gameMinutes,
      previewSeed: (config.previewSeed ?? 0) + 1,
      padResetAt: new Date().toISOString(),
    }
    const err = await updateFriendlySession(game.id, {
      title: game.title,
      players: game.players,
      profileIds: game.profileIds,
      profileAvatars: game.profileAvatars,
      playMode: game.playMode ?? 'organized',
      visibility: game.visibility ?? 'public',
      organizedConfig: next,
      status: game.status,
    })
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setOpen(false)
    await onUpdated()
  }

  if (game.status !== 'ready' || config.ruleFormat !== 'americano' || !sessionEnd) {
    return null
  }

  return (
    <section className="game-card space-y-3 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-brand-primary">{t('friendly.lateStart.title')}</p>
          <p className="text-xs text-brand-muted">
            {t('friendly.lateStart.mustFinish', {
              time: formatClubTime(sessionEnd),
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="brand-btn-outline shrink-0 px-3 py-1.5 text-xs font-semibold"
        >
          {open ? t('common.close') : t('friendly.lateStart.adjust')}
        </button>
      </div>

      {open ? (
        <>
          <SessionTimeSetup
            day={day}
            startHour={startHour}
            startMinute={startMinute}
            onDayChange={setDay}
            onStartHourChange={setStartHour}
            onStartMinuteChange={setStartMinute}
            minuteLabel={t('friendly.startDelay')}
          />
          <button
            type="button"
            onClick={applyNow}
            className="brand-btn-outline w-full py-2 text-xs font-semibold"
          >
            {t('friendly.lateStart.startNow', {
              time: formatHourLabel(bangkokNow().hour, bangkokNow().minute),
            })}
          </button>

          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
              {t('friendly.lateStart.restLabel')}
            </span>
            <input
              type="number"
              min={1}
              max={10}
              value={breakMinutes}
              onChange={(e) =>
                setBreakMinutes(Math.max(1, Math.min(10, Number(e.target.value) || 3)))
              }
              className="brand-input"
            />
          </label>

          {preview ? (
            <>
              <p className="text-xs text-brand-muted tabular-nums">
                {t('friendly.lateStart.remaining', {
                  minutes: preview.playMinutes,
                  rest: breakMinutes,
                })}
              </p>
              <p className="text-sm font-semibold text-brand-primary tabular-nums">
                {t('friendly.lateStart.plan', {
                  games: preview.fit.gameCount,
                  minutes: preview.fit.gameMinutes,
                })}
              </p>
              <CompetitionSchedulePreview
                startsAtIso={preview.startsAtIso}
                eventMinutes={preview.eventMinutes}
                gameCount={preview.fit.gameCount}
                gameMinutes={preview.fit.gameMinutes}
                breakMinutes={breakMinutes}
                playerCount={playerCount}
              />
            </>
          ) : null}

          {!preview?.fit.fits ? (
            <p className="text-xs text-red-600">{t('friendly.lateStart.tooLate')}</p>
          ) : null}

          {error ? <p className="text-xs text-red-600">{error}</p> : null}

          <button
            type="button"
            disabled={busy || !preview?.fit.fits}
            onClick={() => void apply()}
            className="brand-btn w-full py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? t('common.loading') : t('friendly.lateStart.apply')}
          </button>
        </>
      ) : null}
    </section>
  )
}
