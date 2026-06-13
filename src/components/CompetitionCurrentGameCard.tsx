import { useEffect, useMemo, useState } from 'react'
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
import { GameInviteCard } from './GameInviteCard'

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

  return (
    <GameInviteCard
      title={row.title}
      dateLine={schedule.dateLine}
      timeLine={schedule.timeLine}
      detailTo={`/competitions/${row.id}`}
      slots={slots}
      currentUserId={userId}
      ruleChips={ruleChips}
      skillLevel={row.skill_level}
      gender={row.gender}
      statusLine={statusLine || null}
      onShare={() => void shareInvite()}
      shareFeedback={shareFeedback}
      shareAriaLabel={t('competition.shareInvite')}
      canEdit={isAdmin}
      editTo={isAdmin ? `/competitions/${row.id}/edit` : undefined}
      editAriaLabel={t('competition.edit')}
      canDelete={isAdmin}
      onDelete={() => void remove()}
      deleteBusy={busy}
      deleteError={deleteError}
      deleteAriaLabel={t('competition.delete')}
    />
  )
}
