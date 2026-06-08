import type { ReactNode } from 'react'
import { PlayerProfileTabs, type PlayerProfileTab } from './PlayerProfileTabs'

type Props = {
  tab: PlayerProfileTab
  onTab: (tab: PlayerProfileTab) => void
  banner: ReactNode
  children: ReactNode
}

export function PlayerProfileCard({ tab, onTab, banner, children }: Props) {
  return (
    <div className="game-card overflow-hidden p-0">
      {banner}
      <PlayerProfileTabs tab={tab} onTab={onTab} embedded />
      <div>{children}</div>
    </div>
  )
}
