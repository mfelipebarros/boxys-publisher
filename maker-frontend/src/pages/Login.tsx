import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

export function Login() {
  const { signIn, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await signIn(email, password)
    if (err) setError(err.message)
    setLoading(false)
  }

  async function handleGoogleLogin() {
    setError('')
    setGoogleLoading(true)
    const { error: err } = await signInWithGoogle()
    if (err) {
      setError(err.message)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--ink)]">
      <div className="w-full max-w-sm bg-[var(--surface)] rounded-[var(--radius)] p-10 shadow-xl">
        <div className="flex items-baseline gap-2 mb-8">
          <span className="font-bold text-xl text-[var(--ink)]">Boxys</span>
          <span className="text-xs text-[var(--muted)] font-mono">figma → html</span>
        </div>
        <h2 className="text-lg font-semibold mb-6">Entrar</h2>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-raised)] py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {googleLoading ? 'Redirecionando…' : 'Continuar com o Google'}
        </button>

        <div className="flex items-center gap-3 my-4">
          <span className="h-px flex-1 bg-[var(--line)]" />
          <span className="text-xs text-[var(--muted)]">ou</span>
          <span className="h-px flex-1 bg-[var(--line)]" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">E-mail</label>
            <Input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Senha</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="text-xs text-[var(--red)]">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full mt-1 py-2.5">
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
