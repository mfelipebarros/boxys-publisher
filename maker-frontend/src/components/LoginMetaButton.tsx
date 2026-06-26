import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getUserTokensByUserIdAndProvider } from '../utils/MetaDataHandler'

export function LoginMetaButton() {
  const location = useLocation()
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  const META_APP_ID = import.meta.env.VITE_META_APP_ID as string
  const META_REDIRECT_URI = `${window.location.origin}/auth/callback/meta`
  const META_SCOPES = 'ads_management,business_management,pages_show_list,pages_read_engagement,public_profile,ads_read'

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setChecking(false); return }
      const status = await getUserTokensByUserIdAndProvider(user.id)
      setConnected(status.connected)
      setChecking(false)
    }
    check()
  }, [])

  const handleConnect = () => {
    sessionStorage.setItem('meta_return_to', location.pathname)
    const authUrl = `https://www.facebook.com/v23.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}&scope=${META_SCOPES}&response_type=code`
    window.location.href = authUrl
  }

  const handleDisconnect = async () => {
    setLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const { data: { user } } = await supabase.auth.getUser()
      const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string
      await fetch(`${SUPA_URL}/functions/v1/meta_disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id }),
      })
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
          : <MetaIcon className="w-3.5 h-3.5" />
        }
        Desconectar Meta
      </button>
    )
  }

  return (
    <button
      onClick={handleConnect}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0081FB] text-white hover:bg-[#006fd6] transition-colors"
    >
      <MetaIcon className="w-3.5 h-3.5 brightness-200 invert" />
      Conectar Meta Ads
    </button>
  )
}

function MetaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1.086 14.432c-.9.486-1.914-.12-1.914-1.17V8.738c0-1.05 1.014-1.656 1.914-1.17l5.657 3.262c.9.52.9 1.82 0 2.34l-5.657 3.262z"/>
    </svg>
  )
}
