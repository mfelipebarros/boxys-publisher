import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal, ModalFooter } from '../components/ui/Modal'
import type { BoxyCampaign } from '../types'

function FolderIcon({ color = '#0093FF' }: { color?: string }) {
  return (
    <svg viewBox="0 0 56 56" fill="none" className="w-full h-full">
      <rect x="2" y="14" width="52" height="36" rx="5" fill={color} opacity=".18" />
      <path d="M2 20a5 5 0 0 1 5-5h14l4 5H49a5 5 0 0 1 5 5v16a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V20Z" fill={color} opacity=".35" />
      <path d="M2 22a5 5 0 0 1 5-5h14l4 5H49a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V22Z" fill={color} />
    </svg>
  )
}

function CampaignCard({ title, meta, image, onClick, status }: {
  title: string
  meta: string
  image?: string
  onClick: () => void
  status?: 'published' | 'draft'
}) {
  return (
    <div
      onClick={onClick}
      className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--line)] cursor-pointer hover:border-[var(--accent)] transition-all group overflow-hidden relative"
    >
      {status && (
        <span className={`absolute top-2 left-2 z-10 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
          status === 'published' ? 'bg-green-900/60 text-green-400' : 'bg-[var(--surface-raised)] text-[var(--muted)]'
        }`}>
          {status === 'published' ? 'Publicada' : 'Rascunho'}
        </span>
      )}
      <div className="aspect-video bg-[var(--surface-raised)] flex items-center justify-center overflow-hidden">
        {image
          ? <img src={image} alt="" className="w-full h-full object-cover" />
          : <div className="w-12 h-12"><FolderIcon /></div>
        }
      </div>
      <div className="px-3 py-2.5">
        <p className="font-semibold text-sm truncate text-[var(--ink)]">{title}</p>
        <p className="text-xs text-[var(--muted)] mt-1">{meta}</p>
      </div>
    </div>
  )
}

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
      <p className="font-semibold text-sm text-[var(--ink-soft)]">{message}</p>
      {sub && <p className="text-xs text-[var(--muted)] mt-1.5">{sub}</p>}
    </div>
  )
}

export function Home() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [campName, setCampName] = useState('')
  const [campDesc, setCampDesc] = useState('')
  const [campFk, setCampFk] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const { data: boxyData, isLoading } = useQuery({
    queryKey: ['boxy-campaigns'],
    queryFn: () => api.get<{ campaigns: BoxyCampaign[] }>('/api/boxys/campaigns'),
    staleTime: 30_000,
  })

  const lq = q.toLowerCase()
  const campaigns = (boxyData?.campaigns ?? []).filter(c => !lq || c.title.toLowerCase().includes(lq))

  function openCreate() {
    setCampName('')
    setCampDesc('')
    setCampFk('')
    setCreateError('')
    setShowCreate(true)
  }

  async function handleCreate() {
    if (!campName.trim()) return
    setCreating(true)
    setCreateError('')
    try {
      const data = await api.post<{
        status: string
        boxy_campaign?: { id: number }
        local_campaign?: { id: number }
        error?: string
      }>('/api/boxys/campaigns', {
        title: campName.trim(),
        description: campDesc.trim(),
        figma_file_key: campFk.trim(),
        create_local: true,
      })
      qc.invalidateQueries({ queryKey: ['boxy-campaigns'] })
      qc.invalidateQueries({ queryKey: ['local-campaigns'] })
      setShowCreate(false)
      if (data.boxy_campaign?.id) navigate(`/boxys/${data.boxy_campaign.id}`)
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Erro ao criar campanha')
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">Campanhas</h1>
          <p className="text-xs text-[var(--muted)] mt-1">{campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            placeholder="Buscar…"
            value={q}
            onChange={e => setQ(e.target.value)}
            className="w-56"
          />
          <Button onClick={openCreate}>+ Nova campanha</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <span className="text-[var(--muted)] text-sm font-mono">Carregando…</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {campaigns.length === 0
            ? <EmptyState message="Nenhuma campanha" sub="Crie uma campanha para começar." />
            : campaigns.map(c => (
              <CampaignCard
                key={c.id}
                title={c.title}
                meta={`${c.asset_count ?? 0} asset${c.asset_count !== 1 ? 's' : ''} publicado${c.asset_count !== 1 ? 's' : ''}`}
                image={c.image || undefined}
                status={c.published ? 'published' : 'draft'}
                onClick={() => navigate(`/boxys/${c.id}`)}
              />
            ))
          }
        </div>
      )}

      {showCreate && (
        <Modal
          title="Nova campanha"
          onClose={() => setShowCreate(false)}
          size="sm"
          footer={
            <ModalFooter
              onClose={() => setShowCreate(false)}
              onConfirm={handleCreate}
              confirmLabel="Criar"
              loading={creating}
            />
          }
        >
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Nome da campanha</label>
              <Input
                placeholder="ex: Lançamento Jardins"
                value={campName}
                onChange={e => setCampName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Descrição (opcional)</label>
              <Input
                placeholder="Breve descrição da campanha"
                value={campDesc}
                onChange={e => setCampDesc(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">File key do Figma (opcional)</label>
              <Input
                placeholder="cole a URL ou a chave"
                value={campFk}
                onChange={e => setCampFk(e.target.value)}
              />
            </div>
            {createError && (
              <p className="text-xs text-[var(--red)] bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
                {createError}
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
