import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { AUTH_STORAGE_KEY, tryRestoreCachedSession } from '../lib/auth/cachedSession'
import { installLoginWithAppLifecycleDebug } from '../lib/debug/loginWithAppDebug'
import { syncProfileForUser } from '../lib/authProfile'
import { claimPendingPadelPlayer } from '../lib/claimPadelPlayer'
import { supabase } from '../lib/supabaseClient'
import type { Profile } from '../lib/types'

type AuthState = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (authUser: User) => {
    const next = await syncProfileForUser(authUser)
    await claimPendingPadelPlayer()
    setProfile(next)
  }, [])

  const applySession = useCallback(
    async (nextSession: Session | null) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      if (nextSession?.user) await loadProfile(nextSession.user)
      else setProfile(null)
    },
    [loadProfile],
  )

  useEffect(() => {
    installLoginWithAppLifecycleDebug()
  }, [])

  useEffect(() => {
    const onProfileSynced = () => {
      if (user) void loadProfile(user)
    }
    const onLineProfileReady = () => {
      if (!user) return
      void (async () => {
        const { syncLineProfileFromLiff } = await import('../lib/line/profileSync')
        await syncLineProfileFromLiff(user.id)
        await loadProfile(user)
      })()
    }
    window.addEventListener('successpadel:profile-synced', onProfileSynced)
    window.addEventListener('successpadel:line-profile-ready', onLineProfileReady)
    return () => {
      window.removeEventListener('successpadel:profile-synced', onProfileSynced)
      window.removeEventListener('successpadel:line-profile-ready', onLineProfileReady)
    }
  }, [user, loadProfile])

  useEffect(() => {
    let active = true

    void (async () => {
      const restored = await tryRestoreCachedSession()
      if (!active) return
      if (restored) {
        await applySession(restored)
        if (active) setLoading(false)
        return
      }
      const { data } = await supabase.auth.getSession()
      if (!active) return
      await applySession(data.session)
      if (active) setLoading(false)
    })()

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active || event === 'INITIAL_SESSION') return
      void applySession(nextSession).then(() => {
        if (active) setLoading(false)
      })
    })

    const onStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_STORAGE_KEY && event.key !== null) return
      void tryRestoreCachedSession().then((restored) => {
        if (!active) return
        void applySession(restored)
      })
    }
    window.addEventListener('storage', onStorage)

    const refreshOnFocus = () => {
      void tryRestoreCachedSession().then((restored) => {
        if (!active || !restored) return
        void applySession(restored)
      })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshOnFocus()
    }
    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      active = false
      sub.subscription.unsubscribe()
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [applySession])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user)
  }, [user, loadProfile])

  const value = useMemo(
    () => ({ session, user, profile, loading, signOut, refreshProfile }),
    [session, user, profile, loading, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
