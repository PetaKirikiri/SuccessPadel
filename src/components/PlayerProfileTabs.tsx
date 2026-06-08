import { useTranslation } from '../hooks/useTranslation'

export type PlayerProfileTab = 'profile' | 'history'

type Props = {
  tab: PlayerProfileTab
  onTab: (tab: PlayerProfileTab) => void
  embedded?: boolean
}

export function PlayerProfileTabs({ tab, onTab, embedded = false }: Props) {
  const { t } = useTranslation()

  if (embedded) {
    return (
      <div
        className="grid grid-cols-2 border-b border-brand-border/60"
        role="tablist"
        aria-label={t('playerProfile.tabProfile')}
      >
        {(['profile', 'history'] as const).map((id) => {
          const selected = tab === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onTab(id)}
              className={`py-2.5 font-display text-sm transition md:py-3 md:text-base ${
                selected
                  ? 'bg-brand-bg-alt font-semibold text-brand-primary'
                  : 'text-brand-muted hover:bg-brand-bg-alt/40'
              }`}
            >
              {id === 'profile' ? t('playerProfile.tabProfile') : t('playerProfile.tabHistory')}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="game-dock-inner">
      <button
        type="button"
        onClick={() => onTab('profile')}
        className={`game-tab game-tab-rank min-w-0 ${tab === 'profile' ? 'game-tab-selected' : ''}`}
      >
        <span className="font-display text-sm leading-tight md:text-base">{t('playerProfile.tabProfile')}</span>
      </button>
      <button
        type="button"
        onClick={() => onTab('history')}
        className={`game-tab game-tab-competition min-w-0 ${tab === 'history' ? 'game-tab-selected' : ''}`}
      >
        <span className="font-display text-sm leading-tight md:text-base">{t('playerProfile.tabHistory')}</span>
      </button>
    </div>
  )
}
