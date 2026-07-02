import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from './hooks/useAuth'
import { Login } from './pages/Login'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { GeradorPage } from './pages/GeradorPage'
import { BoxyCampaignPage } from './pages/BoxyCampaign'
import { MetaCallback } from './pages/MetaCallback'
import { GoogleAdsFallback } from './pages/GoogleAdsFallback'

const qc = new QueryClient()

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin, checkingRole, signOut } = useAuth()
  if (loading || checkingRole) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--ink)]">
      <span className="text-[var(--muted)] text-sm font-mono">Carregando…</span>
    </div>
  )
  if (!user) return <Login />
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--ink)]">
        <div className="w-full max-w-sm bg-[var(--surface)] rounded-[var(--radius)] p-10 text-center shadow-xl">
          <h2 className="text-lg font-semibold mb-2">Acesso restrito</h2>
          <p className="text-sm text-[var(--muted)] mb-6">
            Esta ferramenta é exclusiva para administradores da Boxys.
          </p>
          <button
            type="button"
            onClick={() => signOut()}
            className="text-sm font-semibold text-[var(--accent)] hover:underline"
          >
            Sair
          </button>
        </div>
      </div>
    )
  }
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthGuard>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/gerador" element={<GeradorPage />} />
              <Route path="/campaigns/:id" element={<Navigate to="/" replace />} />
              <Route path="/boxys/:id" element={<BoxyCampaignPage />} />
              <Route path="/auth/callback/meta" element={<MetaCallback />} />
              <Route path="/auth/callback/google-ads" element={<GoogleAdsFallback />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </AuthGuard>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
