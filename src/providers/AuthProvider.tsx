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
import { installLoginWithAppLifecycleDebug } from '../lib/debug/loginWithAppDebug'
import { syncProfileForUser } from '../lib/authProfile'
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
    setProfile(next)
  }, [])

  useEffect(() => {
    installLoginWithAppLifecycleDebug()
  }, [])

  useEffect(() => {
    const onProfileSynced = () => {
      if (user) void loadProfile(user)
    }
    window.addEventListener('successpadel:profile-synced', onProfileSynced)
    return () => window.removeEventListener('successpadel:profile-synced', onProfileSynced)
  }, [user, loadProfile])

  useEffect(() => {
    let active = true

    const syncUser = async (authUser: User | null) => {
      if (!active) return
      if (authUser) await loadProfile(authUser)
      else setProfile(null)
      if (active) setLoading(false)
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      void syncUser(data.session?.user ?? null)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(true)
      void syncUser(s?.user ?? null)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

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
