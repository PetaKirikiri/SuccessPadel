import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation'
import { saveReturnTo } from '../lib/authReturnTo'

const HOLD_MS = 5000

type Props = {
  returnTo?: string
  className?: string
}

export function GuestSignInChip({ returnTo, className = '' }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const loc = useLocation()
  const [open, setOpen] = useState(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdTriggered = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const guestLabel = t('common.guest')

  const clearHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    holdTimer.current = null
  }

  const goLogin = () => {
    if (loc.pathname === '/login') return
    saveReturnTo(returnTo ?? loc.pathname)
    navigate('/login')
  }

  const onPointerDown = () => {
    holdTriggered.current = false
    clearHold()
    holdTimer.current = setTimeout(() => {
      holdTriggered.current = true
      clearHold()
      setOpen(false)
      goLogin()
    }, HOLD_MS)
  }

  const onPointerUp = () => {
    const releasedEarly = holdTimer.current !== null
    clearHold()
    if (!holdTriggered.current && releasedEarly) setOpen((v) => !v)
  }

  useEffect(() => {
    if (!open) return
    const onDocPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointer)
    return () => document.removeEventListener('pointerdown', onDocPointer)
  }, [open])

  useEffect(() => () => clearHold(), [])

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={clearHold}
        onPointerCancel={clearHold}
        onContextMenu={(e) => e.preventDefault()}
        className="flex h-9 max-w-[9rem] items-center gap-1.5 truncate rounded-full border border-brand-border bg-brand-surface pl-1.5 pr-2.5 text-xs font-medium text-brand-primary md:h-11 md:max-w-[12rem] md:gap-2 md:pl-2 md:pr-3 md:text-sm"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-bg-alt text-[10px] font-semibold text-brand-muted md:h-8 md:w-8 md:text-xs">
          G
        </span>
        <span className="truncate">{guestLabel}</span>
      </button>
      {open && (
        <div
          role="status"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[160] w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border border-brand-border bg-brand-surface px-3 py-3 text-left text-xs leading-relaxed text-brand-text shadow-lg"
        >
          {t('guestChip.playTodayHint')}
        </div>
      )}
    </div>
  )
}
