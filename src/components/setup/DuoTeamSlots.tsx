import { useMemo, type CSSProperties } from 'react'
import { MemberPlayerSlots, type PadelPlayerOption } from './MemberPlayerSlots'
import type { Profile } from '../../lib/types'
import type { DuoTeamDraft } from '../../lib/competitionDuoTeams'
import { duoTeamWatermarkUrl } from '../../lib/duoTeamWatermark'

type Props = {
  teams: DuoTeamDraft[]
  profiles: Profile[]
  padelPlayers?: PadelPlayerOption[]
  onChange: (teams: DuoTeamDraft[]) => void
  onFieldCommit?: () => void
  onRosterCommit?: () => void
  disabled?: boolean
  layout?: 'stack' | 'grid'
  nameInputMode?: 'text' | 'picker'
  linkAvatarsToProfile?: boolean
  competitionId?: string | null
  /** Pill layout for invite card roster editor. */
  inviteChipLayout?: boolean
}

export function DuoTeamSlots({
  teams,
  profiles,
  padelPlayers,
  onChange,
  onFieldCommit,
  onRosterCommit,
  disabled,
  layout = 'stack',
  nameInputMode = 'picker',
  linkAvatarsToProfile = false,
  competitionId = null,
  inviteChipLayout = false,
}: Props) {
  const gridColumns = teams.length <= 4 ? 2 : 4
  const gridRows = Math.max(1, Math.ceil(teams.length / gridColumns))
  const gridMobileRows = Math.max(1, Math.ceil(teams.length / 2))
  const slotNames = useMemo(
    () => teams.flatMap((team) => team.names),
    [teams],
  )
  const slotProfileIds = useMemo(
    () => teams.flatMap((team) => team.profileIds),
    [teams],
  )
  const slotPadelIds = useMemo(
    () => teams.flatMap((team) => team.padelPlayerIds),
    [teams],
  )

  const handleSlotChange = (
    names: string[],
    profileIds: (string | null)[],
    padelPlayerIds: (string | null)[],
  ) => {
    const next = teams.map((team, teamIndex) => {
      const base = teamIndex * 2
      return {
        ...team,
        names: [names[base] ?? '', names[base + 1] ?? ''] as [string, string],
        profileIds: [profileIds[base] ?? null, profileIds[base + 1] ?? null] as [
          string | null,
          string | null,
        ],
        padelPlayerIds: [
          padelPlayerIds[base] ?? null,
          padelPlayerIds[base + 1] ?? null,
        ] as [string | null, string | null],
      }
    })
    onChange(next)
  }

  return (
    <div
      className={
        layout === 'grid'
          ? `duo-team-slots duo-team-slots--grid grid ${
              inviteChipLayout
                ? 'invite-roster-grid invite-roster-grid--fill invite-roster-grid--prominent'
                : 'grid-cols-2 gap-2'
            }`
          : 'duo-team-slots space-y-4'
      }
      style={
        layout === 'grid' && inviteChipLayout
          ? ({
              '--roster-cols': gridColumns,
              '--roster-cols-mobile': 2,
              '--roster-rows': gridRows,
              '--roster-rows-mobile': gridMobileRows,
            } as CSSProperties)
          : undefined
      }
    >
      {teams.map((team, teamIndex) => {
        const watermark = layout === 'grid' ? duoTeamWatermarkUrl(team.label) : null
        return (
        <div
          key={teamIndex}
          className={`duo-team-card ${
            layout === 'grid'
              ? `invite-duo-team-card border-brand-primary/15${watermark ? ' invite-duo-team-card--watermarked' : ''}`
              : 'rounded-xl border border-brand-border/50 bg-brand-bg-alt/40 p-3'
          }`}
          style={
            watermark
              ? ({ '--team-watermark-url': `url(${watermark})` } as CSSProperties)
              : undefined
          }
        >
          <div className={layout === 'grid' ? 'invite-duo-team-label flex min-w-0 items-center gap-2' : 'mb-2 flex items-center gap-2'}>
            {layout === 'stack' ? (
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-brand-muted">
                Team {teamIndex + 1}
              </span>
            ) : null}
            <input
              type="text"
              value={team.label}
              disabled={disabled}
              placeholder={`Team ${teamIndex + 1}`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                const next = [...teams]
                next[teamIndex] = { ...team, label: e.target.value }
                onChange(next)
              }}
              onBlur={() => onFieldCommit?.()}
              className={`brand-input min-w-0 flex-1 font-semibold uppercase tracking-wide ${
                layout === 'grid' ? 'px-2' : 'h-9 text-sm'
              }`}
            />
          </div>
          <div className={inviteChipLayout && layout === 'grid' ? 'invite-duo-team-players' : undefined}>
            <MemberPlayerSlots
              count={2}
              profiles={profiles}
              padelPlayers={padelPlayers}
              names={team.names}
              profileIds={team.profileIds}
              padelPlayerIds={team.padelPlayerIds}
              onChange={(names, profileIds, padelPlayerIds) => {
                const flatNames = [...slotNames]
                const flatProfiles = [...slotProfileIds]
                const flatPadel = [...slotPadelIds]
                const base = teamIndex * 2
                flatNames[base] = names[0] ?? ''
                flatNames[base + 1] = names[1] ?? ''
                flatProfiles[base] = profileIds[0] ?? null
                flatProfiles[base + 1] = profileIds[1] ?? null
                flatPadel[base] = padelPlayerIds[0] ?? null
                flatPadel[base + 1] = padelPlayerIds[1] ?? null
                handleSlotChange(flatNames, flatProfiles, flatPadel)
                onRosterCommit?.()
              }}
              disabled={disabled}
              showMembers
              showPlayerProfiles
              nameInputMode={nameInputMode}
              linkAvatarsToProfile={linkAvatarsToProfile}
              competitionId={competitionId}
              showSlotNumbers={layout !== 'grid'}
              inviteChipLayout={inviteChipLayout && layout === 'grid'}
            />
          </div>
        </div>
        )
      })}
    </div>
  )
}

export type { DuoTeamDraft } from '../../lib/competitionDuoTeams'
export {
  duoTeamsComplete,
  duoTeamsToPairPayload,
  duoTeamsToPairSlotPayload,
  duoTeamsToRosterSlots,
  duoTeamsToScheduleInput,
  emptyDuoTeams,
  filledDuoPlayerCount,
} from '../../lib/competitionDuoTeams'
