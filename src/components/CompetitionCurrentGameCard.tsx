import { useEffect, useMemo, useState } from 'react'
import { SquareArrowUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { FriendlyRosterList } from './FriendlyRosterList'
import { FriendlyRuleSettings } from './FriendlyRuleSettings'
import { useTranslation } from '../hooks/useTranslation'
import { translateCountdownLabel, translatePhaseBadge } from '../i18n/competitionLabels'
import type { CompetitionRow } from '../hooks/useCompetitions'
import {
  competitionCardPhase,
  competitionCountdown,
  competitionIsLiveByTime,
} from '../lib/competitionListCard'
import {
  competitionRosterSlots,
  competitionRuleChips,
  competitionScheduleDisplay,
} from '../lib/competitionGameDisplay'
import { shareCompetitionInvite } from '../lib/competitionLink'
import { supabase } from '../lib/supabaseClient'

type Props = {
  row: CompetitionRow
  isAdmin?: boolean
  userId?: string | null
  onRefresh?: () => void
}

export function CompetitionCurrentGameCard({
  row,
  isAdmin = false,
  userId,
  onRefresh,
}: Props) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const phase = useMemo(() => competitionCardPhase(row, now), [row, now])
  const countdown = useMemo(() => competitionCountdown(row, now), [row, now])
  const schedule = useMemo(() => competitionScheduleDisplay(row), [row])
  const ruleChips = useMemo(() => competitionRuleChips(row, t), [row, t])
  const slots = useMemo(() => competitionRosterSlots(row), [row])
  const badge = translatePhaseBadge(t, phase)
  const isLive = competitionIsLiveByTime(row, now)

  const statusLine = [badge, countdown && `${translateCountdownLabel(t, countdown.label)} ${countdown.value}`]
    .filter(Boolean)
    .join(' · ')

  const detailTo = `/competitions/${row.id}`

  const shareInvite = async () => {
    const result = await shareCompetitionInvite({
      sessionId: row.id,
      title: row.title,
      text: t('competition.shareInviteMessage', { title: row.title }),
    })
    if (result === 'shared' || result === 'copied') {
      setShareFeedback(t('competition.linkCopied'))
      setTimeout(() => setShareFeedback(null), 2000)
    } else if (result === 'failed') {
      setShareFeedback(t('competition.copyFailed'))
      setTimeout(() => setShareFeedback(null), 2000)
    }
  }

  const remove = async () => {
    const warning = isLive
      ? t('competition.deleteLiveConfirm', { title: row.title })
      : t('competition.deleteConfirm', { title: row.title })
    if (!window.confirm(warning)) return

    setBusy(true)
    setDeleteError(null)
    const { error: err } = await supabase.rpc('delete_competition_session', {
      p_session_id: row.id,
    })
    setBusy(false)
    if (err) setDeleteError(err.message)
    else onRefresh?.()
  }

  const dateTitleRow = (
    <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
      <p className="min-w-0 flex-1 break-words font-display text-base font-bold leading-tight text-brand-primary sm:text-xl md:text-2xl">
        {schedule.dateLine}
      </p>
      <p className="min-w-0 max-w-[46%] shrink-0 text-right font-display text-sm font-semibold leading-snug text-brand-primary line-clamp-2 sm:max-w-[42%] sm:text-base md:text-lg">
        {row.title}
      </p>
    </div>
  )

  const timeRow = schedule.timeLine ? (
    <p className="break-all font-display text-lg font-bold leading-tight tabular-nums text-brand-text sm:break-words sm:text-2xl md:text-3xl">
      {schedule.timeLine}
    </p>
  ) : null

  const inner = (
    <div className="min-w-0 overflow-hidden px-3 py-3 pr-12 sm:px-4 sm:py-4 sm:pr-14">
      {ruleChips.length > 0 ? (
        <div className="flex w-full min-w-0 max-w-full flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <div className="flex min-w-0 max-w-full flex-1 flex-col justify-center gap-0.5 sm:gap-1">
            {dateTitleRow}
            {timeRow}
            {statusLine ? (
              <p className="text-xs font-semibold tabular-nums text-brand-accent">{statusLine}</p>
            ) : null}
          </div>
          <FriendlyRuleSettings chips={ruleChips} inline />
        </div>
      ) : (
        <div className="min-w-0 space-y-0.5">
          {dateTitleRow}
          {timeRow}
          {statusLine ? (
            <p className="text-xs font-semibold tabular-nums text-brand-accent">{statusLine}</p>
          ) : null}
        </div>
      )}

      <div className="mt-4 border-t-2 border-brand-border pt-3">
        <FriendlyRosterList slots={slots} currentUserId={userId} />
      </div>
    </div>
  )

  return (
    <article className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border-2 border-brand-primary/25 bg-brand-surface shadow-[0_4px_16px_-4px_rgba(96,45,36,0.22)]">
      <div className="relative min-w-0">
        <button
          type="button"
          onClick={() => void shareInvite()}
          aria-label={t('competition.shareInvite')}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-brand-border bg-brand-bg-alt text-brand-primary shadow-sm active:scale-[0.98] sm:right-4 sm:top-4"
        >
          <SquareArrowUp className="h-4 w-4" aria-hidden />
        </button>
        {shareFeedback ? (
          <p className="absolute right-3 top-[3.25rem] z-10 rounded-lg bg-brand-surface px-2 py-0.5 text-[10px] font-medium text-brand-muted shadow-sm sm:right-4">
            {shareFeedback}
          </p>
        ) : null}
        <Link to={detailTo} className="block min-w-0 overflow-hidden transition active:opacity-80">
          {inner}
        </Link>
      </div>

      {isAdmin ? (
        <div className="flex gap-2 border-t-2 border-brand-border px-4 py-3">
          <Link
            to={`/competitions/${row.id}/edit`}
            className="brand-btn-outline min-w-0 flex-1 py-2 text-center text-sm font-semibold"
          >
            {t('competition.edit')}
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove()}
            className="min-w-0 flex-1 rounded-xl border border-brand-border py-2 text-sm font-medium text-brand-muted disabled:opacity-50"
          >
            {t('competition.delete')}
          </button>
        </div>
      ) : null}

      {deleteError ? <p className="px-4 pb-3 text-xs text-red-600">{deleteError}</p> : null}
    </article>
  )
}
