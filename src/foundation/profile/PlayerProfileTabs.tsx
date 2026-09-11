import { useTranslation } from '../../hooks/useTranslation'
import { History, UserRound, MessageSquare } from 'lucide-react'
import '../../layouts/coach-feedback.layout.css'

export type PlayerProfileTab = 'profile' | 'history' | 'feedback'

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
        className="profile-section-tabs"
        role="tablist"
        aria-label={t('playerProfile.tabProfile')}
      >
        {(['profile', 'history', 'feedback'] as const).map((id, index) => {
          const selected = tab === id
          const Icon = id === 'profile' ? UserRound : id === 'history' ? History : MessageSquare
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              id={`player-section-${id}`}
              aria-controls="player-section-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => onTab(id)}
              onKeyDown={(event) => {
                const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : null
                if (next === null) return
                event.preventDefault()
                onTab((['profile', 'history', 'feedback'] as const)[next])
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
              }}
            >
              <Icon aria-hidden="true" />
              <span>{id === 'profile' ? t('playerProfile.tabProfile') : id === 'history' ? t('playerProfile.tabHistory') : 'Coach Feedback'}</span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="profile-section-tabs">
      <button
        type="button"
        onClick={() => onTab('profile')}
        aria-pressed={tab === 'profile'}
      >
        <UserRound aria-hidden="true" />
        <span>{t('playerProfile.tabProfile')}</span>
      </button>
      <button
        type="button"
        onClick={() => onTab('history')}
        aria-pressed={tab === 'history'}
      >
        <History aria-hidden="true" />
        <span>{t('playerProfile.tabHistory')}</span>
      </button>
      <button type="button" onClick={() => onTab('feedback')} aria-pressed={tab === 'feedback'}><MessageSquare aria-hidden="true" /><span>Coach Feedback</span></button>
    </div>
  )
}
