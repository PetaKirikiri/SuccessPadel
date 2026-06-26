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
import {
  AUTH_STORAGE_KEY,
  clearBrowserSessionBackup,
  rememberBrowserSession,
  tryRestoreCachedSession,
} from '../lib/auth/cachedSession'
import { lineHandshakeDebug } from '../lib/debug/lineHandshakeDebug'
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

  const loadProfile = useCallback(async (authUser: User): Promise<Profile | null> => {
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', authUser.id)
      .maybeSingle()

    if (!profileRow) {
      // #region agent log
      lineHandshakeDebug('S7-session', 'AuthProvider.tsx:orphan', 'no profile row — signing out', 'H8', {
        userIdPrefix: authUser.id.slice(0, 8),
        emailDomain: authUser.email?.split('@')[1] ?? null,
      })
      // #endregion
      await supabase.auth.signOut()
      return null
    }

    const next = await syncProfileForUser(authUser)
    if (!next) return null

    await claimPendingPadelPlayer()
    // #region agent log
    lineHandshakeDebug('S7-session', 'AuthProvider.tsx:profile', 'profile loaded', 'H8', {
      userIdPrefix: authUser.id.slice(0, 8),
      displayName: next.display_name?.slice(0, 24) ?? null,
      hasLineId: Boolean(next.line_user_id),
    })
    // #endregion
    setProfile(next)
    return next
  }, [])

  const applySession = useCallback(
    async (nextSession: Session | null) => {
      // #region agent log
      lineHandshakeDebug('S7-session', 'AuthProvider.tsx:apply', 'applySession', 'H5', {
        hasSession: Boolean(nextSession?.user),
        userIdPrefix: nextSession?.user?.id?.slice(0, 8) ?? null,
      })
      // #endregion
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      if (nextSession?.user) {
        rememberBrowserSession(nextSession)
        const loaded = await loadProfile(nextSession.user)
        if (!loaded) {
          setSession(null)
          setUser(null)
          setProfile(null)
        }
      } else {
        setProfile(null)
      }
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
    clearBrowserSessionBackup()
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
