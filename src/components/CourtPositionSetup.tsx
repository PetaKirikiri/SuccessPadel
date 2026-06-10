import { useEffect } from 'react'
import type { CourtPlayer } from '../lib/americanoSchedule'
import { agentDebugIngest } from '../lib/debug/devDebug'
import {
  COURT_QUADRANTS,
  netFacingHalf,
  playerKey,
  teamForQuadrant,
  teamIsPlaced,
} from '../lib/courtPositionSetup'
import type { Quadrant } from '../lib/gestureCapture'
import type { QuadrantPlayers } from '../lib/gesturePadPlayers'
import { firstDisplayName } from '../lib/leaderboardEntries'
import { GesturePadSetupWizard, WIZARD_BTN } from './GesturePadSetupWizard'
import { pct } from '../lib/padelCourtLayout'
import { serverBoxBounds } from '../lib/serveRotation'
import { useTranslation } from '../hooks/useTranslation'

const CHIP_ANCHOR: Record<Quadrant, string> = {
  TL: 'top-1 left-1 justify-start sm:top-1.5 sm:left-1.5',
  TR: 'top-1 right-1 justify-end sm:top-1.5 sm:right-1.5',
  BL: 'bottom-1 left-1 justify-start sm:bottom-1.5 sm:left-1.5',
  BR: 'bottom-1 right-1 justify-end sm:bottom-1.5 sm:right-1.5',
}

type Props = {
  assignments: Partial<QuadrantPlayers>
  wizardPlayer: CourtPlayer | null
  pendingConfirm: boolean
  showPlacementPrompt: boolean
  highlightPlayerKey?: string | null
  onAssignQuadrant: (quadrant: Quadrant) => void
  onAcceptTeam: () => void
  onSwapTeam: () => void
  onUndoTeam: () => void
}

function ServerBoxPlayerChip({
  player,
  highlighted,
  alignRight,
  large = false,
}: {
  player: CourtPlayer
  highlighted: boolean
  alignRight: boolean
  large?: boolean
}) {
  const name = firstDisplayName(player.name.trim() || '?')
  return (
    <div
      className={`pointer-events-none flex min-w-0 items-center gap-1.5 truncate rounded-full border shadow-sm ${
        large
          ? 'max-w-full gap-2 py-1 pl-1 pr-3 sm:py-1.5 sm:pl-1.5 sm:pr-4'
          : 'max-w-[min(100%,9rem)] py-0.5 pl-0.5 pr-2 sm:max-w-[10rem] sm:pr-2.5'
      } ${
        highlighted
          ? 'border-white bg-white text-[#11355c]'
          : 'border-white/35 bg-black/45 text-white'
      } ${alignRight ? 'flex-row-reverse pl-2 pr-0.5 sm:pl-2.5 sm:pr-0.5' : ''}`}
    >
      {player.avatarUrl ? (
        <img
          src={player.avatarUrl}
          alt=""
          className={`shrink-0 rounded-full object-cover ring-1 ring-white/40 ${
            large ? 'h-10 w-10 sm:h-11 sm:w-11' : 'h-7 w-7 sm:h-8 sm:w-8'
          }`}
        />
      ) : (
        <span
          className={`flex shrink-0 items-center justify-center rounded-full font-bold ${
            large ? 'h-10 w-10 text-base sm:h-11 sm:w-11 sm:text-lg' : 'h-7 w-7 text-xs sm:h-8 sm:w-8 sm:text-sm'
          } ${highlighted ? 'bg-[#11355c]/10 text-[#11355c]' : 'bg-white/15 text-white'}`}
        >
          {name[0]?.toUpperCase() ?? '?'}
        </span>
      )}
      <span
        className={`min-w-0 truncate font-semibold ${
          large ? 'text-base sm:text-lg' : 'text-xs sm:text-sm'
        }`}
      >
        {name}
      </span>
    </div>
  )
}

export function CourtPositionSetup({
  assignments,
  wizardPlayer,
  pendingConfirm,
  showPlacementPrompt,
  highlightPlayerKey,
  onAssignQuadrant,
  onAcceptTeam,
  onSwapTeam,
  onUndoTeam,
}: Props) {
  const { t } = useTranslation()

  const showModal = Boolean(wizardPlayer && (pendingConfirm || showPlacementPrompt))

  // #region agent log
  useEffect(() => {
    const chipsOnCourt = COURT_QUADRANTS.filter((q) => assignments[q]?.name?.trim()).map((q) => ({
      q,
      name: assignments[q]!.name.trim(),
    }))
    agentDebugIngest(
      'CourtPositionSetup.tsx:chips',
      'server-box chips render',
      {
        chipCount: chipsOnCourt.length,
        chips: chipsOnCourt,
        showPlacementPrompt,
        pendingConfirm,
        wizardPlayer: wizardPlayer?.name ?? null,
      },
      chipsOnCourt.length > 0 && showPlacementPrompt ? 'A' : chipsOnCourt.length > 0 && pendingConfirm ? 'B' : 'A',
    )
  }, [assignments, pendingConfirm, showPlacementPrompt, wizardPlayer])
  // #endregion

  return (
    <>
    <div className="absolute inset-0 z-[6]">
      {COURT_QUADRANTS.map((quadrant) => {
        const bounds = serverBoxBounds(quadrant)
        const player = assignments[quadrant]
        const taken = Boolean(player?.name?.trim())
        const boxTeam = teamForQuadrant(quadrant)
        const teamPlaced = teamIsPlaced(boxTeam, assignments)
        const showChip = taken && (pendingConfirm || teamPlaced)
        const teamOpen = !teamPlaced
        const canPick = !pendingConfirm && teamOpen
        const facingLeft = netFacingHalf(quadrant) === 'left'
        const sideLabel = facingLeft
          ? t('pad.positions.sideLeft')
          : t('pad.positions.sideRight')
        const roleLabel = facingLeft
          ? t('pad.positions.powerSide')
          : t('pad.positions.controlSide')
        const alignRight = quadrant === 'TR' || quadrant === 'BR'

        return (
          <button
            key={quadrant}
            type="button"
            disabled={!canPick}
            aria-label={quadrant}
            className={`absolute touch-none transition-colors ${
              !teamOpen && !taken
                ? 'cursor-default opacity-20'
                : canPick
                  ? 'court-server-box-blink cursor-pointer'
                  : 'cursor-default'
            }`}
            style={{
              left: pct(bounds.xMin),
              top: pct(bounds.yMin),
              width: pct(bounds.xMax - bounds.xMin),
              height: pct(bounds.yMax - bounds.yMin),
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              if (canPick) onAssignQuadrant(quadrant)
            }}
          >
            {!taken ? (
              <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                <span className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-white/35 sm:text-xs">
                  {roleLabel}
                </span>
                <span className="font-display text-sm font-semibold uppercase tracking-[0.28em] text-white/28 sm:text-base">
                  {sideLabel}
                </span>
              </span>
            ) : null}
            {showChip && player ? (
              <div
                className={`pointer-events-none absolute flex ${CHIP_ANCHOR[quadrant]}`}
              >
                <ServerBoxPlayerChip
                  player={player}
                  highlighted={
                    Boolean(highlightPlayerKey && playerKey(player) === highlightPlayerKey)
                  }
                  alignRight={alignRight}
                />
              </div>
            ) : null}
          </button>
        )
      })}

    </div>

    {showModal && wizardPlayer ? (
      <GesturePadSetupWizard
        interactive={pendingConfirm}
        message={showPlacementPrompt ? t('pad.positions.chooseWherePrompt') : undefined}
      >
        {showPlacementPrompt ? (
          <ServerBoxPlayerChip
            player={wizardPlayer}
            highlighted
            alignRight={false}
            large
          />
        ) : null}
        {pendingConfirm ? (
          <div className="grid w-full grid-cols-3 gap-3 sm:gap-4">
            <button type="button" onClick={onUndoTeam} className={WIZARD_BTN}>
              {t('pad.positions.undo')}
            </button>
            <button type="button" onClick={onSwapTeam} className={WIZARD_BTN}>
              {t('pad.positions.swapSides')}
            </button>
            <button type="button" onClick={onAcceptTeam} className={WIZARD_BTN}>
              {t('pad.positions.accept')}
            </button>
          </div>
        ) : null}
      </GesturePadSetupWizard>
    ) : null}
    </>
  )
}
