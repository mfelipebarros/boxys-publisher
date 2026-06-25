import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

export function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await signIn(email, password)
    if (err) setError(err.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--ink)]">
      <div className="w-full max-w-sm bg-[var(--surface)] rounded-[var(--radius)] p-10 shadow-xl">
        <div className="flex items-baseline gap-2 mb-8">
          <span className="font-bold text-xl text-[var(--ink)]">Boxys</span>
          <span className="text-xs text-[var(--muted)] font-mono">figma → html</span>
        </div>
        <h2 className="text-lg font-semibold mb-6">Entrar</h2>
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
