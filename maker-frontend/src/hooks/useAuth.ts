import { useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingRole, setCheckingRole] = useState(false)

  async function applySession(s: Session | null) {
    setSession(s)
    setUser(s?.user ?? null)

    if (!s?.user) {
      setIsAdmin(false)
      return
    }

    setCheckingRole(true)
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', s.user.id)
      .maybeSingle()
    setIsAdmin(data?.role === 'adm')
    setCheckingRole(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session).then(() => setLoading(false))
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      applySession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signIn = (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password })

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })

  const signOut = () => supabase.auth.signOut()

  return { user, session, loading, isAdmin, checkingRole, signIn, signInWithGoogle, signOut }
}
