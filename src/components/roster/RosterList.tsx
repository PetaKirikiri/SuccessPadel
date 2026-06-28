import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { useViewportBucket } from '../../contexts/ViewportContext'
import { useTranslation } from '../../hooks/useTranslation'
import { firstDisplayName } from '../../lib/leaderboardEntries'
import type { CompetitionTeamSlot } from '../../lib/competitionGameDisplay'
import type { RosterSlot } from '../../lib/friendlyGameDisplay'
import { duoTeamWatermarkUrl } from '../../lib/duoTeamWatermark'
import { PlayerAvatarLink } from '../PlayerAvatarLink'
import { PlayerNameLink } from '../PlayerNameLink'

type SharedProps = {
  currentUserId?: string | null
  competitionId?: string | null
  prominent?: boolean
  fill?: boolean
}

type FlatProps = SharedProps & {
  format: 'flat'
  slots: RosterSlot[]
}

type DuoProps = SharedProps & {
  format: 'duo'
  teams: CompetitionTeamSlot[]
}

type Props = FlatProps | DuoProps

function useEqualRosterChipWidth(chipCount: number) {
  const bucket = useViewportBucket()
  const fillParent = bucket === 'tablet' || bucket === 'web' || bucket === 'tv'
  const gridRef = useRef<HTMLUListElement>(null)

  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    const measure = () => {
      const chips = Array.from(grid.querySelectorAll<HTMLElement>('.invite-roster-chip'))
      if (chips.length === 0) return

      if (fillParent) {
        grid.style.setProperty('--roster-chip-width', '100%')
        chips.forEach((chip) => {
          chip.style.width = ''
        })
        return
      }

      grid.style.removeProperty('--roster-chip-width')
      chips.forEach((chip) => {
        chip.style.width = ''
      })

      const max = Math.max(...chips.map((chip) => chip.getBoundingClientRect().width), 0)
      if (max > 0) {
        grid.style.setProperty('--roster-chip-width', `${Math.ceil(max)}px`)
      }
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(grid)
    return () => observer.disconnect()
  }, [chipCount, fillParent])

  return gridRef
}

function rosterSizing() {
  return {
    avatar: 'invite-roster-chip__avatar shrink-0 rounded-full object-cover',
    name: 'invite-roster-chip__name min-w-0',
    vacantAvatar: 'invite-roster-chip__vacant-avatar shrink-0 rounded-full',
    vacantName: 'invite-roster-chip__vacant-name min-w-0',
    chipGap: '',
    chipPad: '',
  }
}

function PlayerChip({
  slot,
  currentUserId,
  competitionId,
}: {
  slot: RosterSlot
  currentUserId?: string | null
  competitionId?: string | null
}) {
  const { t } = useTranslation()
  const isMe = Boolean(currentUserId && slot.profileId === currentUserId)
  const size = rosterSizing()

  if (slot.vacant) {
    return (
      <span
        className={`invite-roster-chip h-full items-center rounded-full border border-dashed border-brand-primary/25 bg-brand-bg-alt text-brand-muted ${size.chipGap} ${size.chipPad}`}
      >
        <span className={`invite-roster-chip__vacant-avatar ${size.vacantAvatar}`}>+</span>
        <span className={`invite-roster-chip__vacant-name ${size.vacantName}`}>{t('friendly.openSpots')}</span>
      </span>
    )
  }

  const name = firstDisplayName(slot.name || 'Player')
  return (
    <span
      className={`invite-roster-chip h-full items-center rounded-full border ${size.chipGap} ${size.chipPad} ${
        isMe
          ? 'border-brand-accent/50 bg-brand-accent/10'
          : 'border-brand-primary/20 bg-brand-bg-alt'
      }`}
    >
      <PlayerAvatarLink
        displayName={slot.name}
        avatarUrl={slot.avatarUrl}
        profileId={slot.profileId}
        padelPlayerId={slot.padelPlayerId}
        competitionId={competitionId}
        imgClassName={`invite-roster-chip__avatar ${size.avatar}`}
      />
      <PlayerNameLink
        displayName={name}
        profileId={slot.profileId}
        padelPlayerId={slot.padelPlayerId}
        competitionId={competitionId}
        className={`invite-roster-chip__name ${size.name} ${isMe ? 'text-brand-accent' : 'text-brand-primary'}`}
      />
    </span>
  )
}

export function RosterList(props: Props) {
  const { t } = useTranslation()
  const prominent = props.prominent ?? false
  const fill = props.fill ?? false
  const size = rosterSizing()
  const gridClass = [
    'invite-roster-grid m-0 grid w-full min-w-0 max-w-full list-none p-0',
    fill ? 'invite-roster-grid--fill min-h-0 flex-1' : '',
    prominent ? 'invite-roster-grid--prominent' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (props.format === 'duo') {
    const { teams, currentUserId, competitionId } = props
    const columns = teams.length <= 4 ? 2 : 4
    const rows = Math.max(1, Math.ceil(teams.length / columns))
    const gridRef = useEqualRosterChipWidth(teams.length * 2)
    return (
      <ul
        ref={gridRef}
        className={gridClass}
        style={
          {
            '--roster-cols': columns,
            '--roster-cols-mobile': 2,
            '--roster-rows': rows,
            '--roster-rows-mobile': Math.max(1, Math.ceil(teams.length / 2)),
          } as CSSProperties
        }
      >
        {teams.map((team) => {
          const watermark = duoTeamWatermarkUrl(team.label)
          return (
          <li
            key={team.pairId ?? `team-${team.teamIndex}`}
            className={`invite-duo-team-card flex min-h-0 flex-col ${
              team.vacant
                ? 'border-dashed border-brand-primary/25 bg-brand-bg-alt/40'
                : 'border-brand-primary/15 bg-brand-bg-alt/60'
            }${watermark ? ' invite-duo-team-card--watermarked' : ''}`}
            style={
              watermark
                ? ({ '--team-watermark-url': `url(${watermark})` } as CSSProperties)
                : undefined
            }
          >
            <p className="invite-duo-team-label shrink-0 truncate">
              {team.label}
            </p>
            <div className="invite-duo-team-players flex min-h-0 flex-1 flex-col justify-center">
              {team.players.map((slot, side) => (
                <PlayerChip
                  key={side}
                  slot={slot}
                  currentUserId={currentUserId}
                  competitionId={competitionId}
                />
              ))}
            </div>
          </li>
        )})}
      </ul>
    )
  }

  const { slots, currentUserId, competitionId } = props
  const columns = slots.length <= 4 ? 2 : slots.length <= 8 ? 3 : 4
  const rows = Math.max(1, Math.ceil(slots.length / columns))
  const gridRef = useEqualRosterChipWidth(slots.length)
  return (
    <ul
      ref={gridRef}
      className={gridClass}
      style={
        {
          '--roster-cols': columns,
          '--roster-cols-mobile': slots.length <= 4 ? 2 : 3,
          '--roster-rows': rows,
          '--roster-rows-mobile': Math.max(1, Math.ceil(slots.length / (slots.length <= 4 ? 2 : 3))),
        } as CSSProperties
      }
    >
      {slots.map((slot, i) => {
        const isMe = Boolean(currentUserId && slot.profileId === currentUserId)
        if (slot.vacant) {
          return (
            <li
              key={`open-${i}`}
              className={`invite-roster-chip h-full items-center rounded-full border border-dashed border-brand-primary/25 bg-brand-bg-alt text-brand-muted ${size.chipGap} ${size.chipPad}`}
            >
              <span className={`invite-roster-chip__vacant-avatar ${size.vacantAvatar}`}>+</span>
              <span className={`invite-roster-chip__vacant-name ${size.vacantName}`}>{t('friendly.openSpots')}</span>
            </li>
          )
        }

        const name = firstDisplayName(slot.name || 'Player')
        return (
          <li
            key={`${slot.profileId ?? slot.padelPlayerId ?? slot.name}-${i}`}
            className={`invite-roster-chip h-full items-center rounded-full border ${size.chipGap} ${size.chipPad} ${
              isMe
                ? 'border-brand-accent/50 bg-brand-accent/10'
                : 'border-brand-primary/20 bg-brand-bg-alt'
            }`}
          >
            <PlayerAvatarLink
              displayName={slot.name}
              avatarUrl={slot.avatarUrl}
              profileId={slot.profileId}
              padelPlayerId={slot.padelPlayerId}
              competitionId={competitionId}
              imgClassName={`invite-roster-chip__avatar ${size.avatar}`}
            />
            <PlayerNameLink
              displayName={name}
              profileId={slot.profileId}
              padelPlayerId={slot.padelPlayerId}
              competitionId={competitionId}
              className={`invite-roster-chip__name ${size.name} ${isMe ? 'text-brand-accent' : 'text-brand-primary'}`}
            />
          </li>
        )
      })}
    </ul>
  )
}
