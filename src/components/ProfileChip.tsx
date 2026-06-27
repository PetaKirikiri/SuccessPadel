import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useSignInChip } from '../hooks/useSignInChip'
import { useTranslation } from '../hooks/useTranslation'
import { useLineClientProfile } from '../hooks/useLineClientProfile'
import { firstDisplayName } from '../lib/leaderboardEntries'
import { playerProfilePath } from '../lib/playerProfileSlug'
import { resolveProfileAvatarUrl } from '../lib/resolveProfileAvatar'
import { useTheme } from '../providers/ThemeProvider'
import { LanguagePicker } from './LanguagePicker'
import { LineSignInModal } from './LineSignInModal'
import { IconProfile } from './ShellTabIcons'
import { ThemeToggleButton } from './ThemeToggleButton'

type Props = {
  returnTo?: string
  className?: string
  navItem?: boolean
}

export function ProfileChip({ returnTo, className = '', navItem = false }: Props) {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const lineClient = useLineClientProfile()
  const { openProfile, modalOpen, setModalOpen, busy } = useSignInChip(returnTo)
  const [menuOpen, setMenuOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const isSignedIn = Boolean(user)
  const signInLabel = t('common.signIn')
  const name = isSignedIn
    ? firstDisplayName(profile?.display_name ?? lineClient.displayName)
    : signInLabel
  const avatarUrl = isSignedIn
    ? profile
      ? resolveProfileAvatarUrl(profile)
      : (lineClient.pictureUrl ?? null)
    : null
  const isAdmin = Boolean(profile?.is_admin)
  const isDark = theme === 'dark'
  const chipClass = isAdmin
    ? 'border-brand-gold bg-brand-gold-light ring-1 ring-brand-gold/40 text-brand-gold-dark shadow-sm'
    : isDark
      ? 'border-white/35 bg-black/40 text-white'
      : 'border-brand-border bg-brand-surface text-brand-primary'
  const buttonClass = navItem
    ? `game-tab w-full ${menuOpen ? 'game-tab-selected' : ''}`
    : `flex h-9 max-w-[9rem] items-center gap-1.5 truncate rounded-full border pl-1.5 pr-2.5 text-xs font-medium disabled:opacity-60 md:h-11 md:max-w-[12rem] md:gap-2 md:pl-2 md:pr-3 md:text-sm ${chipClass}`
  const avatarClass = `h-6 w-6 shrink-0 rounded-full object-cover md:h-8 md:w-8 ${isAdmin ? 'ring-2 ring-brand-gold' : ''}`
  const fallbackAvatarClass =
    `flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold md:h-8 md:w-8 md:text-xs ${
        isAdmin ? 'bg-brand-gold/25 text-brand-gold-dark ring-2 ring-brand-gold' : 'bg-brand-bg-alt text-brand-muted'
      }`
  const menuClass = navItem
    ? 'absolute bottom-full right-0 z-[300] mb-2 min-w-[13rem] overflow-hidden rounded-xl border border-brand-border bg-brand-surface py-1 shadow-lg dark:border-white/15 dark:bg-[#11355c]'
    : 'absolute right-0 top-full z-[300] mt-1 min-w-[13rem] overflow-hidden rounded-xl border border-brand-border bg-brand-surface py-1 shadow-lg dark:border-white/15 dark:bg-[#11355c]'

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const goProfile = () => {
    if (!user) return
    setMenuOpen(false)
    navigate(playerProfilePath({ id: user.id, displayName: profile?.display_name }))
  }

  const goMembers = () => {
    setMenuOpen(false)
    navigate('/members')
  }

  const goGestureScore = () => {
    setMenuOpen(false)
    navigate('/gesture-score-test')
  }

  return (
    <>
      <div ref={rootRef} className={`relative ${className}`}>
        <button
          type="button"
          disabled={busy}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((open) => !open)}
          className={buttonClass}
        >
          {navItem ? <IconProfile className="game-tab-icon" /> : avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className={avatarClass}
            />
          ) : (
            <span className={fallbackAvatarClass}>
              {isSignedIn ? name.trim()[0]?.toUpperCase() ?? '?' : signInLabel.trim()[0]?.toUpperCase() ?? '?'}
            </span>
          )}
          <span
            className={
              navItem
                ? `overflow-hidden truncate whitespace-nowrap text-[11px] leading-tight transition-all duration-200 md:text-sm ${
                    menuOpen ? 'max-w-[7rem] opacity-100' : 'max-w-0 opacity-0'
                  }`
                : 'truncate'
            }
          >
            {busy ? t('signInModal.checkingSession') : name}
          </span>
        </button>

        {menuOpen ? (
          <div
            role="menu"
            className={menuClass}
          >
            {isSignedIn ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={goProfile}
                  className="block w-full px-3 py-2.5 text-left text-sm font-medium text-brand-primary transition hover:bg-brand-bg-alt active:bg-brand-bg-alt"
                >
                  {t('members.myProfile')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={goMembers}
                  className="block w-full px-3 py-2.5 text-left text-sm font-medium text-brand-primary transition hover:bg-brand-bg-alt active:bg-brand-bg-alt"
                >
                  {t('members.title')}
                </button>
                <div className="my-1 border-t border-brand-border" role="separator" />
              </>
            ) : (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    void openProfile()
                  }}
                  className="block w-full px-3 py-2.5 text-left text-sm font-medium text-brand-primary transition hover:bg-brand-bg-alt active:bg-brand-bg-alt"
                >
                  {t('common.signIn')}
                </button>
                <div className="my-1 border-t border-brand-border" role="separator" />
              </>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={goGestureScore}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-brand-primary transition hover:bg-brand-bg-alt active:bg-brand-bg-alt"
            >
              <Camera className="h-4 w-4 shrink-0 text-brand-accent" strokeWidth={2.4} aria-hidden />
              Gesture score
            </button>
            <div className="px-3 py-2.5">
              <p className="mb-2 text-left text-xs font-semibold uppercase tracking-wide text-brand-muted">
                {t('aria.language')}
              </p>
              <LanguagePicker dark={theme === 'dark'} />
            </div>
            <ThemeToggleButton
              showLabel
              menuItem
              dark={theme === 'dark'}
              className="h-auto w-full justify-start rounded-none border-0 bg-transparent px-3 py-2.5 hover:bg-brand-bg-alt active:bg-brand-bg-alt"
            />
          </div>
        ) : null}
      </div>
      {modalOpen ? (
        <LineSignInModal returnTo={returnTo} onClose={() => setModalOpen(false)} />
      ) : null}
    </>
  )
}
