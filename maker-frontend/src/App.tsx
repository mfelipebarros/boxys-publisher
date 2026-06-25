import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from './hooks/useAuth'
import { Login } from './pages/Login'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { BoxyCampaignPage } from './pages/BoxyCampaign'
import { LocalCampaignPage } from './pages/LocalCampaign'

const qc = new QueryClient()

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--ink)]">
      <span className="text-[var(--muted)] text-sm font-mono">Carregando…</span>
    </div>
  )
  return user ? <>{children}</> : <Login />
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthGuard>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/campaigns/:id" element={<LocalCampaignPage />} />
              <Route path="/boxys/:id" element={<BoxyCampaignPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </AuthGuard>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
