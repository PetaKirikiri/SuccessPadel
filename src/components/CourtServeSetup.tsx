import { controlServeQuadrants, COURT_QUADRANTS } from '../lib/courtPositionSetup'
import type { Quadrant } from '../lib/gestureCapture'
import type { QuadrantPlayers } from '../lib/gesturePadPlayers'
import { pct } from '../lib/padelCourtLayout'
import {
  confirmServeCoinPlacement,
  playForServeCoinPlacement,
  serverBoxBounds,
} from '../lib/serveRotation'
import { useTranslation } from '../hooks/useTranslation'
import { CourtPlayerAvatarCoin } from './CourtPlayerAvatarCoin'
import {
  GesturePadSetupWizard,
  WIZARD_BTN,
  WIZARD_PRIMARY_BTN,
} from './GesturePadSetupWizard'
type Props = {
  phase: 'serve' | 'confirm_serve'
  pendingServe: Quadrant | null
  assignments: Partial<QuadrantPlayers>
  onPickServe: (quadrant: Quadrant) => void
  onConfirmServe: () => void
  onChangeServe: () => void
}

function coinPlacementFor(
  quadrant: Quadrant,
  phase: Props['phase'],
  pendingServe: Quadrant | null,
) {
  if (phase === 'confirm_serve' && pendingServe) {
    return confirmServeCoinPlacement(quadrant, pendingServe)
  }
  return playForServeCoinPlacement(quadrant)
}

export function CourtServeSetup({
  phase,
  pendingServe,
  assignments,
  onPickServe,
  onConfirmServe,
  onChangeServe,
}: Props) {
  const { t } = useTranslation()
  const controlQuadrants = controlServeQuadrants()
  const pendingPlayer =
    pendingServe && assignments[pendingServe]?.name?.trim()
      ? assignments[pendingServe]
      : null
  const showPickModal = phase === 'serve'
  const showConfirmModal = phase === 'confirm_serve' && pendingPlayer

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-[6]">
        {COURT_QUADRANTS.map((quadrant) => {
          const player = assignments[quadrant]
          if (!player?.name?.trim()) return null
          const placement = coinPlacementFor(quadrant, phase, pendingServe)
          const topHalf = quadrant === 'TL' || quadrant === 'TR'
          const isPending = pendingServe === quadrant

          return (
            <div
              key={`coin-${quadrant}`}
              className="absolute"
              style={{
                left: placement.left,
                top: placement.top,
                transform: placement.transform,
              }}
            >
              <CourtPlayerAvatarCoin
                player={player}
                topHalf={topHalf}
                serving={phase === 'confirm_serve' && isPending}
                highlighted={phase === 'confirm_serve' && isPending}
              />
            </div>
          )
        })}
      </div>

      <div className="absolute inset-0 z-[7]">
        {controlQuadrants.map((quadrant) => {
          const bounds = serverBoxBounds(quadrant)
          const canPick = phase === 'serve' && Boolean(assignments[quadrant]?.name?.trim())

          return (
            <button
              key={`pick-${quadrant}`}
              type="button"
              disabled={!canPick}
              aria-label={quadrant}
              className={`absolute touch-none bg-transparent transition-colors ${
                canPick ? 'court-server-box-blink cursor-pointer' : 'cursor-default'
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
                if (canPick) onPickServe(quadrant)
              }}
            />
          )
        })}
      </div>

      {showPickModal ? (
        <GesturePadSetupWizard
          title={t('pad.serve.playForServe')}
          subtitle={t('pad.serve.thenSelectingServer')}
        />
      ) : null}

      {showConfirmModal && pendingPlayer ? (
        <GesturePadSetupWizard interactive>
          <CourtPlayerAvatarCoin
            player={pendingPlayer}
            size="lg"
            highlighted
            serving
            topHalf={pendingServe === 'TL' || pendingServe === 'TR'}
          />
          <p className="text-center text-sm font-semibold text-white">
            {t('pad.serve.startGame')}
          </p>
          <div className="grid w-full grid-cols-2 gap-3 sm:gap-4">
            <button type="button" onClick={onChangeServe} className={WIZARD_BTN}>
              {t('pad.serve.confirmChange')}
            </button>
            <button type="button" onClick={onConfirmServe} className={WIZARD_PRIMARY_BTN}>
              {t('pad.serve.confirmYes')}
            </button>
          </div>
        </GesturePadSetupWizard>
      ) : null}
    </>
  )
}
