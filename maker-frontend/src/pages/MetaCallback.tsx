import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { handleFinishOnboardingMeta } from '../utils/MetaDataHandler'

export function MetaCallback() {
  const [message, setMessage] = useState('Conectando à sua conta Meta...')
  const navigate = useNavigate()

  useEffect(() => {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    const error = url.searchParams.get('error')
    const returnTo = sessionStorage.getItem('meta_return_to') ?? '/'

    const redirect = (msg?: string) => {
      if (msg) setMessage(msg)
      setTimeout(() => navigate(returnTo), 1500)
    }

    if (error || !code) {
      redirect('Conexão cancelada. Voltando...')
      return
    }

    const exchange = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const { data: { user } } = await supabase.auth.getUser()
        const token = sessionData.session?.access_token

        if (!token || !user) {
          redirect('Usuário não autenticado. Tente novamente.')
          return
        }

        const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string
        const redirect_uri = `${window.location.origin}/auth/callback/meta`

        const resp = await fetch(`${SUPA_URL}/functions/v1/exchange_token_meta`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirect_uri }),
        })
        const json = await resp.json()

        if (!resp.ok || !json.success) {
          redirect('Falha ao conectar conta Meta.')
          return
        }

        const adAccounts = json.ad_accounts ?? []
        await handleFinishOnboardingMeta(adAccounts)

        sessionStorage.removeItem('meta_return_to')
        setMessage('Conta Meta conectada com sucesso!')
        setTimeout(() => navigate(returnTo), 1500)
      } catch (err) {
        console.error(err)
        redirect('Erro inesperado. Voltando...')
      }
    }

    exchange()
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-[var(--muted)]">{message}</p>
    </div>
  )
}
