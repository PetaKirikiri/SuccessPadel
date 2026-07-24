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
  clearLocalAuthState,
  ensureWritableSession,
  keepSessionAlive,
  readStoredAuthUserId,
  rememberBrowserSession,
  tryRestoreCachedSession,
} from '../lib/auth/cachedSession'
import { readCachedProfile, rememberCachedProfile } from '../lib/auth/cachedProfile'
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
  restoreSession: () => Promise<Session | null>
}

const AuthContext = createContext<AuthState | null>(null)

const SESSION_KEEPALIVE_MS = 4 * 60_000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const dropLocalIdentity = useCallback(() => {
    clearLocalAuthState()
    setSession(null)
    setUser(null)
    setProfile(null)
  }, [])

  const loadProfile = useCallback(async (authUser: User): Promise<Profile | null> => {
    const next = await syncProfileForUser(authUser)

    if (!next) {
      const cached = readCachedProfile(authUser.id)
      if (cached) {
        setProfile(cached)
        return cached
      }
      lineHandshakeDebug('S7-session', 'AuthProvider.tsx:orphan', 'profile sync failed — keeping session', 'H8', {
        userIdPrefix: authUser.id.slice(0, 8),
      })
      return null
    }

    await claimPendingPadelPlayer()
    rememberCachedProfile(next)
    lineHandshakeDebug('S7-session', 'AuthProvider.tsx:profile', 'profile loaded', 'H8', {
      userIdPrefix: authUser.id.slice(0, 8),
      displayName: next.display_name?.slice(0, 24) ?? null,
      hasLineId: Boolean(next.line_user_id),
    })
    setProfile(next)
    return next
  }, [])

  const applySession = useCallback(
    async (nextSession: Session | null) => {
      lineHandshakeDebug('S7-session', 'AuthProvider.tsx:apply', 'applySession', 'H5', {
        hasSession: Boolean(nextSession?.user),
        userIdPrefix: nextSession?.user?.id?.slice(0, 8) ?? null,
      })

      if (nextSession?.user) {
        setSession(nextSession)
        setUser(nextSession.user)
        rememberBrowserSession(nextSession)
        const cached = readCachedProfile(nextSession.user.id)
        if (cached) setProfile(cached)
        await loadProfile(nextSession.user)
        return
      }

      const restored = await tryRestoreCachedSession()
      if (restored?.user) {
        setSession(restored)
        setUser(restored.user)
        rememberBrowserSession(restored)
        const cached = readCachedProfile(restored.user.id)
        if (cached) setProfile(cached)
        await loadProfile(restored.user)
        return
      }

      const storedId = readStoredAuthUserId()
      if (storedId) {
        const cached = readCachedProfile(storedId)
        const late = await keepSessionAlive()
        if (late?.user) {
          setSession(late)
          setUser(late.user)
          rememberBrowserSession(late)
          if (cached) setProfile(cached)
          await loadProfile(late.user)
          return
        }
      }

      setSession(null)
      setUser(null)
      setProfile(null)
    },
    [loadProfile],
  )

  useEffect(() => {
    installLoginWithAppLifecycleDebug()
  }, [])

  const pullLiveSession = useCallback(async () => {
    const writable = await ensureWritableSession()
    if (writable?.user) {
      await applySession(writable)
      return writable
    }
    const { data } = await supabase.auth.getSession()
    if (data.session?.user) {
      await applySession(data.session)
      return data.session
    }
    dropLocalIdentity()
    return null
  }, [applySession, dropLocalIdentity])

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
    const onSessionReady = () => {
      void pullLiveSession()
    }
    window.addEventListener('successpadel:profile-synced', onProfileSynced)
    window.addEventListener('successpadel:line-profile-ready', onLineProfileReady)
    window.addEventListener('successpadel:session-ready', onSessionReady)
    return () => {
      window.removeEventListener('successpadel:profile-synced', onProfileSynced)
      window.removeEventListener('successpadel:line-profile-ready', onLineProfileReady)
      window.removeEventListener('successpadel:session-ready', onSessionReady)
    }
  }, [user, loadProfile, pullLiveSession])

  useEffect(() => {
    let active = true

    void (async () => {
      const restored = await tryRestoreCachedSession()
      if (!active) return
      if (restored) {
        await applySession(restored)
      } else {
        const { data } = await supabase.auth.getSession()
        if (!active) return
        if (data.session?.user) {
          await applySession(data.session)
        } else {
          await applySession(null)
        }
      }
      if (active) setLoading(false)
    })()

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active || event === 'INITIAL_SESSION') return

      if (event === 'TOKEN_REFRESHED' && nextSession?.user) {
        setSession(nextSession)
        setUser(nextSession.user)
        rememberBrowserSession(nextSession)
        return
      }

      if (event === 'SIGNED_OUT') {
        void tryRestoreCachedSession().then((restored) => {
          if (!active) return
          if (restored?.user) {
            void applySession(restored)
          } else {
            dropLocalIdentity()
          }
        })
        return
      }

      void applySession(nextSession).then(() => {
        if (active) setLoading(false)
      })
    })

    const onStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_STORAGE_KEY && event.key !== null) return
      void tryRestoreCachedSession().then((restored) => {
        if (!active || !restored) return
        void applySession(restored)
      })
    }
    window.addEventListener('storage', onStorage)

    const refreshOnFocus = () => {
      void keepSessionAlive().then((restored) => {
        if (!active) return
        if (restored) {
          void applySession(restored)
        } else {
          dropLocalIdentity()
        }
      })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshOnFocus()
    }
    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', onVisibility)

    const keepAliveTimer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void keepSessionAlive().then((restored) => {
        if (!active) return
        if (!restored) {
          dropLocalIdentity()
          return
        }
        setSession(restored)
        setUser(restored.user)
        rememberBrowserSession(restored)
      })
    }, SESSION_KEEPALIVE_MS)

    return () => {
      active = false
      sub.subscription.unsubscribe()
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(keepAliveTimer)
    }
  }, [applySession, dropLocalIdentity])

  const restoreSession = useCallback(async () => {
    return pullLiveSession()
  }, [pullLiveSession])

  const signOut = useCallback(async () => {
    dropLocalIdentity()
    await supabase.auth.signOut()
  }, [dropLocalIdentity])

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user)
  }, [user, loadProfile])

  const value = useMemo(
    () => ({ session, user, profile, loading, signOut, refreshProfile, restoreSession }),
    [session, user, profile, loading, signOut, refreshProfile, restoreSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
