import { IconHubLeaderboard, IconPlayGames, shellTabClass } from './ShellTabIcons'

export type PlayViewTab = 'games' | 'leaderboard'

export function PlayViewTabs({
  tab,
  onTab,
  t,
}: {
  tab: PlayViewTab
  onTab: (t: PlayViewTab) => void
  t: (key: string) => string
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => onTab('games')}
        className={shellTabClass(tab === 'games', 'competition')}
      >
        <IconPlayGames />
        <span>{t('competition.games')}</span>
      </button>
      <button
        type="button"
        onClick={() => onTab('leaderboard')}
        className={shellTabClass(tab === 'leaderboard', 'rank')}
      >
        <IconHubLeaderboard />
        <span>{t('competition.leaderboard')}</span>
      </button>
    </>
  )
}
