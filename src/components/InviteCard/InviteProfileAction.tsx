import { useEffect, useId, useRef, useState } from 'react'
import { Mic, UserRound } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSignInChip } from '../../hooks/useSignInChip'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabaseClient'
import { playerProfilePath } from '../../lib/playerProfileSlug'
import { LineSignInModal } from '../../shared/Modal/LineSignInModal'

export function InviteProfileAction({ competitionId }: { competitionId: string }) {
  const { openProfile, modalOpen, setModalOpen, busy } = useSignInChip()
  const { user, profile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const viewerId = user?.id
  const [access, setAccess] = useState<{ viewer: string; allowed: boolean } | null>(null)
  useEffect(() => {
    if (!viewerId) return
    let active = true
    void supabase.rpc('can_record_coach_feedback').then(({ data, error }) => {
      if (active) setAccess({ viewer: viewerId, allowed: !error && data === true })
    })
    return () => { active = false }
  }, [viewerId])
  const from = location.pathname + location.search
  const goProfile = () => {
    if (!user) { void openProfile(); return }
    const path = playerProfilePath({ id: user.id, displayName: profile?.display_name, competitionId })
    navigate(path, { state: { from } })
  }
  return <>
    <InviteProfileMenu busy={busy} canRecordCoach={Boolean(viewerId && access?.viewer === viewerId && access.allowed)}
      onProfile={goProfile}
      onCoach={() => navigate(`/coaches-comment?competition=${competitionId}`, { state: { from } })} />
    {modalOpen ? <LineSignInModal onClose={() => setModalOpen(false)} /> : null}
  </>
}

type MenuProps = { busy: boolean; canRecordCoach: boolean; onProfile: () => void; onCoach: () => void }

export function InviteProfileMenu({ busy, canRecordCoach, onProfile, onCoach }: MenuProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])
  function choose(action: () => void) {
    setOpen(false)
    trigger.current?.focus()
    action()
  }
  return <div className="invite-game-card__profile-menu-root" ref={root} onClick={event => event.stopPropagation()}
    onKeyDown={event => {
      if (event.key === 'Escape' && open) {
        event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus()
      }
    }}>
    <button ref={trigger} type="button" className="invite-game-card__profile-action"
      aria-label="Profile menu" title="Profile menu" disabled={busy}
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true) } }}
      onClick={() => setOpen(value => !value)}>
      <UserRound className="invite-game-card__profile-icon" aria-hidden="true" />
    </button>
    {open ? <div id={menuId} ref={menu} role="menu" aria-label="Profile" className="invite-game-card__profile-menu"
      onKeyDown={event => {
        if (event.key === 'Tab') { setOpen(false); return }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]
        const index = items.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 :
          (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
        items[next]?.focus()
      }}>
      <button type="button" role="menuitem" onClick={() => choose(onProfile)}><UserRound aria-hidden="true" />Member profile</button>
      {canRecordCoach ? <button type="button" role="menuitem" onClick={() => choose(onCoach)}><Mic aria-hidden="true" />Coaches Comment</button> : null}
    </div> : null}
  </div>
}
