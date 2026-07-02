import { useEffect, useRef, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingRole, setCheckingRole] = useState(false)
  // Último usuário cuja role já foi verificada. Evita re-disparar o gate de
  // "checando role" (que remonta o app) quando o Supabase emite TOKEN_REFRESHED
  // ao focar a aba do navegador — é o mesmo usuário, não precisa re-checar.
  const checkedUserId = useRef<string | null>(null)

  async function applySession(s: Session | null) {
    setSession(s)
    setUser(s?.user ?? null)

    const uid = s?.user?.id ?? null
    if (!uid) {
      checkedUserId.current = null
      setIsAdmin(false)
      return
    }

    // Mesmo usuário já verificado (ex: refresh de token em background): não mexe
    // no checkingRole — assim o AuthGuard não pisca a tela de carregando nem remonta.
    if (uid === checkedUserId.current) return

    setCheckingRole(true)
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', uid)
      .maybeSingle()
    setIsAdmin(data?.role === 'adm')
    checkedUserId.current = uid
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
