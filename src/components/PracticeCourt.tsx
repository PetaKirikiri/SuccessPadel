import { GestureAnnotationPad } from './GestureAnnotationPad'
import {
  PRACTICE_COURT_SETUP_KEY,
  PRACTICE_ROSTER,
  practiceQuadrantPlayers,
} from '../lib/practiceCourt'

type Props = {
  onExit: () => void
}

/**
 * Full-screen court canvas for redesign — no scoreboard, nav, or log.
 * Court fills the device with out-area margins proportional to FIP dimensions.
 */
export function PracticeCourt({ onExit: _onExit }: Props) {
  return (
    <div className="practice-court practice-court-canvas fixed inset-0 z-[400] overflow-hidden bg-[#1a5fa8]">
      <GestureAnnotationPad
        courtSetupKey={PRACTICE_COURT_SETUP_KEY}
        onMatchClosed={_onExit}
        quadrantPlayers={practiceQuadrantPlayers()}
        sessionRoster={PRACTICE_ROSTER}
        currentUserId={null}
        practiceMode
        courtOnly
        naturalOrientation
        endlessMatch
      />
    </div>
  )
}
