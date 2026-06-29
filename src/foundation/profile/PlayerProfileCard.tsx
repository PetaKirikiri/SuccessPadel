import type { ReactNode } from 'react'
import { PlayerProfileTabs, type PlayerProfileTab } from './PlayerProfileTabs'

type Props = {
  tab: PlayerProfileTab
  onTab: (tab: PlayerProfileTab) => void
  banner: ReactNode
  children: ReactNode
  hideTabs?: boolean
}

export function PlayerProfileCard({ tab, onTab, banner, children, hideTabs = false }: Props) {
  return (
    <div className="game-card p-0">
      {banner}
      {hideTabs ? null : <PlayerProfileTabs tab={tab} onTab={onTab} embedded />}
      <div className="min-w-0">{children}</div>
    </div>
  )
}
