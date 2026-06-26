import { useEffect } from 'react'

export function GoogleAdsFallback() {
  const params = new URLSearchParams(window.location.search)
  const ok = params.get('ok') === 'true'
  const error = params.get('error')
  const msg = params.get('msg')

  useEffect(() => {
    let payload: unknown
    if (msg) {
      try { payload = JSON.parse(msg) } catch { payload = null }
    }
    if (!payload) {
      payload = { type: 'google-ads-oauth', ok, error }
    }

    try {
      if (window.opener) window.opener.postMessage(payload, window.location.origin)
    } catch (e) {
      console.error('postMessage error:', e)
    }

    const timer = setTimeout(() => window.close(), 2500)
    return () => clearTimeout(timer)
  }, [ok, msg, error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--canvas)]">
      <div className="text-center px-6 py-8 bg-[var(--surface)] border border-[var(--line)] rounded-2xl shadow-xl max-w-sm">
        <div className="text-4xl mb-3">{ok ? '✅' : '⚠️'}</div>
        <h1 className="text-base font-semibold text-[var(--ink)] mb-2">
          {ok ? 'Google Ads conectado!' : 'Erro ao conectar Google Ads'}
        </h1>
        <p className="text-xs text-[var(--muted)]">
          {ok ? 'Fechando automaticamente…' : 'Feche esta janela e tente novamente.'}
        </p>
        {error && <p className="text-[11px] text-[var(--muted)] mt-2"><code>{error}</code></p>}
      </div>
    </div>
  )
}
