import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export function LoginGoogleAdsButton() {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const popupRef = useRef<Window | null>(null)

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setChecking(false); return }

      const { data } = await supabase
        .from('ad_connections')
        .select('id')
        .eq('user_id', user.id)
        .eq('provider', 'google_ads')
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      setConnected(!!data)
      setChecking(false)
    }
    check()
  }, [])

  const handleMessage = useCallback((event: MessageEvent) => {
    if (!event.data || event.data.type !== 'google-ads-oauth') return

    if (event.data.ok) setConnected(true)
    popupRef.current?.close()
  }, [])

  useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [handleMessage])

  const openPopup = (url: string) => {
    const w = 600, h = 700
    const left = window.screenX + (window.outerWidth - w) / 2
    const top = window.screenY + (window.outerHeight - h) / 2
    popupRef.current = window.open(url, 'google-ads-oauth', `width=${w},height=${h},left=${left},top=${top}`)
  }

  const handleConnect = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase.functions.invoke('google-oauth-start', {
        body: { userId: user?.id },
      })
      if (error || !data?.authUrl) { setLoading(false); return }
      openPopup(data.authUrl)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase
        .from('ad_connections')
        .update({ status: 'revoked' })
        .eq('user_id', user?.id ?? '')
        .eq('provider', 'google_ads')
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }

  if (checking) return null

  if (connected) {
    return (
      <button
        onClick={handleDisconnect}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-400/40 text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
      >
        {loading
          ? <span className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
          : <GoogleIcon className="w-3.5 h-3.5" />
        }
        Desconectar Google Ads
      </button>
    )
  }

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#111827] text-white hover:bg-[#1f2937] transition-colors disabled:opacity-50"
    >
      {loading
        ? <span className="w-3 h-3 border border-white/50 border-t-transparent rounded-full animate-spin" />
        : <GoogleIcon className="w-3.5 h-3.5" />
      }
      Conectar Google Ads
    </button>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
