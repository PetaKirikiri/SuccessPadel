import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { tryRestoreCachedSession } from '../lib/auth/cachedSession'
import { saveReturnTo } from '../lib/authReturnTo'

export function useSignInChip(returnTo?: string) {
  const navigate = useNavigate()
  const loc = useLocation()
  const { user } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const openProfile = async () => {
    if (user) {
      const path = `/players/${user.id}`
      if (loc.pathname === path) return
      navigate(path)
      return
    }

    setBusy(true)
    saveReturnTo(returnTo ?? `${loc.pathname}${loc.search}`)

    const session = await tryRestoreCachedSession()
    setBusy(false)

    if (session?.user) {
      navigate(returnTo ?? `/players/${session.user.id}`)
      return
    }

    setModalOpen(true)
  }

  return { openProfile, modalOpen, setModalOpen, busy }
}
