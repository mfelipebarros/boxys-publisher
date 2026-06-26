import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { LocalCampaign, BoxyCampaign } from '../types'

function SidebarItem({ to, label, count, active }: { to: string; label: string; count?: number; active: boolean }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
        active
          ? 'bg-[var(--accent-bg)] text-[var(--accent)]'
          : 'text-[var(--muted)] hover:text-[var(--ink-soft)] hover:bg-[var(--surface-raised)]'
      }`}
    >
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="text-[10px] font-mono text-[var(--muted)] bg-[var(--surface-raised)] px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </Link>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()

  const { data: localData } = useQuery({
    queryKey: ['local-campaigns'],
    queryFn: () => api.get<{ campaigns: LocalCampaign[] }>('/api/campaigns'),
    staleTime: 30_000,
  })

  const { data: boxyData } = useQuery({
    queryKey: ['boxy-campaigns'],
    queryFn: () => api.get<{ campaigns: BoxyCampaign[] }>('/api/boxys/campaigns'),
    staleTime: 30_000,
  })

  const localCampaigns = localData?.campaigns ?? []
  const boxyCampaigns = boxyData?.campaigns ?? []

  return (
    <div className="flex min-h-screen bg-[var(--canvas)]">
      {/* Topbar */}
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center gap-4 px-5 border-b border-[var(--line)]"
        style={{ height: 'var(--topbar-h)', background: 'var(--surface)' }}
      >
        <Link to="/" className="flex items-baseline gap-2 flex-none">
          <span className="font-bold text-lg text-[var(--ink)]">Makezinho</span>
        </Link>
        <div className="flex-1" />
        <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--muted)] bg-[var(--surface-raised)] border border-[var(--line)] px-3 py-1.5 rounded-lg">
          <span className="truncate max-w-[180px]">{user?.email}</span>
          <button onClick={signOut} className="hover:text-[var(--ink)] transition-colors ml-1">
            Sair
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className="fixed top-0 bottom-0 bg-[var(--surface)] border-r border-[var(--line)] flex flex-col overflow-y-auto py-4"
        style={{ width: 'var(--sidebar-w)', top: 'var(--topbar-h)' }}
      >
        <div className="px-3.5 mb-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] px-2 pb-2">
            Navegação
          </p>
          <SidebarItem to="/" label="Todas as campanhas" active={pathname === '/'} />
        </div>

        <div className="mx-3.5 my-3 h-px bg-[var(--line)]" />

        <div className="px-3.5 mb-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] px-2 pb-2">
            Boxys
          </p>
          {boxyCampaigns.length === 0 && (
            <p className="text-xs text-[var(--muted)] px-2 py-1">Nenhuma campanha</p>
          )}
          {boxyCampaigns.map(c => (
            <SidebarItem
              key={c.id}
              to={`/boxys/${c.id}`}
              label={c.title}
              count={c.asset_count}
              active={pathname === `/boxys/${c.id}`}
            />
          ))}
        </div>

        <div className="mx-3.5 my-3 h-px bg-[var(--line)]" />

        <div className="px-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] px-2 pb-2">
            Publisher
          </p>
          {localCampaigns.length === 0 && (
            <p className="text-xs text-[var(--muted)] px-2 py-1">Nenhuma campanha</p>
          )}
          {localCampaigns.map(c => (
            <SidebarItem
              key={c.id}
              to={`/campaigns/${c.id}`}
              label={c.name}
              count={c.creative_count}
              active={pathname === `/campaigns/${c.id}`}
            />
          ))}
        </div>
      </aside>

      {/* Main */}
      <main
        className="flex-1 min-h-screen"
        style={{ paddingTop: 'var(--topbar-h)', marginLeft: 'var(--sidebar-w)' }}
      >
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
