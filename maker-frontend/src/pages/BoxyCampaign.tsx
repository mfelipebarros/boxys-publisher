import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import { Modal, ModalFooter } from '../components/ui/Modal'
import { CreativesTab } from '../components/campaign/CreativesTab'
import { CopiesTab } from '../components/campaign/CopiesTab'
import { CarouselsTab } from '../components/campaign/CarouselsTab'
import { ExportTab } from '../components/campaign/ExportTab'
import { SearchTab } from '../components/campaign/SearchTab'
import type {
  BoxyCampaign, BoxyAdvertisement, BocySocialCreative, BoxyLandingPage,
  LocalCampaign, LocalCreative, LocalCopy, LocalCarousel,
} from '../types'

interface CampaignDetailResponse {
  campaign: BoxyCampaign
  advertisements: BoxyAdvertisement[]
  social_creatives: BocySocialCreative[]
  landing_pages: BoxyLandingPage[]
}

interface LocalDetailResponse {
  campaign: LocalCampaign
  creatives: LocalCreative[]
  copies: LocalCopy[]
  carousels: LocalCarousel[]
}

type PublishType = 'advertisement' | 'social_creative' | 'landing_page'
type TabKey = 'boxys' | 'creatives' | 'copies' | 'carousels' | 'search' | 'export'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'boxys', label: 'Publicações Boxys' },
  { key: 'creatives', label: 'Criativos' },
  { key: 'copies', label: 'Copies' },
  { key: 'carousels', label: 'Carrosseis' },
  { key: 'search', label: 'Search Ads' },
  { key: 'export', label: 'Export ZIP' },
]

function StatusBadge({ published }: { published: boolean }) {
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
      published ? 'bg-green-900/50 text-green-400' : 'bg-[var(--surface-raised)] text-[var(--muted)]'
    }`}>
      {published ? 'Publicado' : 'Rascunho'}
    </span>
  )
}

function AssetRow({ title, subtitle, published }: { title: string; subtitle?: string; published: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-raised)] transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--ink)] truncate">{title}</p>
        {subtitle && <p className="text-xs text-[var(--muted)] mt-0.5">{subtitle}</p>}
      </div>
      <StatusBadge published={published} />
    </div>
  )
}

function PublishModal({
  boxyId, boxyTitle, defaultType, localCreatives, onClose,
}: {
  boxyId: number; boxyTitle: string; defaultType: PublishType
  localCreatives: LocalCreative[]; onClose: () => void
}) {
  const qc = useQueryClient()
  const [type, setType] = useState<PublishType>(defaultType)
  const [creativeId, setCreativeId] = useState('')
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handlePublish() {
    if (!creativeId) { setError('Selecione um criativo.'); return }
    if (type === 'landing_page' && !slug.trim()) { setError('Slug é obrigatório para landing pages.'); return }
    setLoading(true); setError('')
    try {
      await api.post('/api/boxys/publish', {
        creative_id: Number(creativeId),
        campaign_id: boxyId,
        type,
        title: title.trim() || undefined,
        slug: type === 'landing_page' ? slug.trim() : undefined,
      })
      qc.invalidateQueries({ queryKey: ['boxy-campaign', String(boxyId)] })
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao publicar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={`Publicar em "${boxyTitle}"`}
      onClose={onClose}
      footer={<ModalFooter onClose={onClose} onConfirm={handlePublish} confirmLabel="Publicar" loading={loading} />}
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-semibold text-[var(--muted)] mb-2">Tipo de conteúdo</label>
          <div className="grid grid-cols-3 gap-2">
            {(['advertisement', 'social_creative', 'landing_page'] as PublishType[]).map(t => (
              <button key={t} onClick={() => setType(t)} className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                type === t
                  ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]'
                  : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--muted)]'
              }`}>
                {t === 'advertisement' ? 'Anúncio' : t === 'social_creative' ? 'Social' : 'Landing Page'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--muted)] mb-2">Criativo</label>
          <Select value={creativeId} onChange={e => setCreativeId(e.target.value)}>
            <option value="">Selecionar criativo…</option>
            {localCreatives.map(c => (
              <option key={c.id} value={String(c.id)}>
                {c.name} {c.format_label ? `(${c.format_label})` : c.width ? `(${c.width}×${c.height})` : ''}
              </option>
            ))}
          </Select>
          {localCreatives.length === 0 && (
            <p className="text-xs text-[var(--muted)] mt-1">Nenhum criativo local. Importe HTMLs na aba Criativos.</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--muted)] mb-2">Título (opcional)</label>
          <Input placeholder="Título do asset" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        {type === 'landing_page' && (
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-2">Slug <span className="text-[var(--red)]">*</span></label>
            <Input placeholder="ex: aria-mooca-lp" value={slug} onChange={e => setSlug(e.target.value)} />
          </div>
        )}
        {error && <p className="text-xs text-[var(--red)] bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">{error}</p>}
      </div>
    </Modal>
  )
}

function BoxysTab({
  campaign, advertisements, social_creatives, landing_pages, localCreatives,
}: {
  campaign: BoxyCampaign
  advertisements: BoxyAdvertisement[]
  social_creatives: BocySocialCreative[]
  landing_pages: BoxyLandingPage[]
  localCreatives: LocalCreative[]
}) {
  const [publishModal, setPublishModal] = useState<PublishType | null>(null)

  function Section({ title, count, type, children }: {
    title: string; count: number; type: PublishType; children: React.ReactNode
  }) {
    const [open, setOpen] = useState(true)
    return (
      <div className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--line)] overflow-hidden mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)]">
          <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2 flex-1 text-left">
            <svg viewBox="0 0 20 20" fill="currentColor"
              className={`w-4 h-4 text-[var(--muted)] transition-transform flex-none ${open ? 'rotate-180' : ''}`}>
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            <span className="font-semibold text-sm text-[var(--ink)]">{title}</span>
            <span className="text-xs font-mono text-[var(--muted)]">{count}</span>
          </button>
          <Button size="sm" onClick={() => setPublishModal(type)}>+ Publicar</Button>
        </div>
        {open && (count === 0
          ? <p className="text-xs text-[var(--muted)] px-4 py-5 text-center">Nenhum item publicado ainda.</p>
          : <div>{children}</div>
        )}
      </div>
    )
  }

  return (
    <div>
      <Section title="Anúncios" count={advertisements.length} type="advertisement">
        {advertisements.map(ad => (
          <AssetRow key={ad.id} title={ad.title || 'Sem título'}
            subtitle={[ad.format, ad.dimensions].filter(Boolean).join(' · ')} published={ad.published} />
        ))}
      </Section>
      <Section title="Criativos Sociais" count={social_creatives.length} type="social_creative">
        {social_creatives.map(sc => (
          <AssetRow key={sc.id} title={sc.title || 'Sem título'} subtitle={sc.format} published={sc.published} />
        ))}
      </Section>
      <Section title="Landing Pages" count={landing_pages.length} type="landing_page">
        {landing_pages.map(lp => (
          <AssetRow key={lp.id} title={lp.slug} published={lp.published} />
        ))}
      </Section>
      {publishModal && (
        <PublishModal
          boxyId={campaign.id}
          boxyTitle={campaign.title}
          defaultType={publishModal}
          localCreatives={localCreatives}
          onClose={() => setPublishModal(null)}
        />
      )}
    </div>
  )
}

export function BoxyCampaignPage() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<TabKey>('boxys')
  const qc = useQueryClient()
  const creatingLocal = useRef(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['boxy-campaign', id],
    queryFn: () => api.get<CampaignDetailResponse>(`/api/boxys/campaigns/${id}`),
    enabled: !!id,
  })

  const { data: localData } = useQuery({
    queryKey: ['local-campaigns'],
    queryFn: () => api.get<{ campaigns: LocalCampaign[] }>('/api/campaigns'),
    staleTime: 30_000,
  })

  const linkedLocal = (localData?.campaigns ?? []).find(c => c.boxys_campaign_id === Number(id))

  // Auto-cria campanha local vinculada quando não existe
  useEffect(() => {
    if (!data || !localData) return
    if (linkedLocal) return
    if (creatingLocal.current) return
    creatingLocal.current = true
    api.post<{ status: string; campaign: LocalCampaign }>('/api/campaigns', {
      name: data.campaign.title,
      boxys_campaign_id: data.campaign.id,
    }).then(() => {
      qc.invalidateQueries({ queryKey: ['local-campaigns'] })
    }).catch(console.error)
  }, [data, localData, linkedLocal, qc])

  const { data: localDetail } = useQuery({
    queryKey: ['local-campaign', String(linkedLocal?.id)],
    queryFn: () => api.get<LocalDetailResponse>(`/api/campaigns/${linkedLocal!.id}`),
    enabled: !!linkedLocal?.id,
  })

  const localCreatives = localDetail?.creatives ?? []
  const localCopies = localDetail?.copies ?? []
  const localCarousels = localDetail?.carousels ?? []
  const localCampaignId = String(linkedLocal?.id ?? '')

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <span className="text-[var(--muted)] text-sm font-mono">Carregando…</span>
    </div>
  )

  if (error || !data) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <p className="text-sm text-[var(--muted)]">Erro ao carregar campanha.</p>
      <Link to="/"><Button variant="ghost">Voltar</Button></Link>
    </div>
  )

  const { campaign, advertisements, social_creatives, landing_pages } = data

  const tabCounts: Partial<Record<TabKey, number>> = {
    boxys: advertisements.length + social_creatives.length + landing_pages.length,
    creatives: localCreatives.length,
    copies: localCopies.length,
    carousels: localCarousels.length,
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="flex items-start gap-4">
          {campaign.image && (
            <img src={campaign.image} alt="" className="w-16 h-16 rounded-lg object-cover flex-none border border-[var(--line)]" />
          )}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold text-[var(--ink)]">{campaign.title}</h1>
              <StatusBadge published={campaign.published} />
            </div>
            <p className="text-xs text-[var(--muted)] font-mono">
              {advertisements.length} anúncio{advertisements.length !== 1 ? 's' : ''} ·{' '}
              {social_creatives.length} social{social_creatives.length !== 1 ? 's' : ''} ·{' '}
              {landing_pages.length} landing page{landing_pages.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Link to="/"><Button variant="secondary">← Voltar</Button></Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border-b border-[var(--line)]">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
              tab === t.key
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink-soft)]'
            }`}
          >
            {t.label}
            {tabCounts[t.key] !== undefined && (
              <span className="text-[10px] font-mono bg-[var(--surface-raised)] px-1.5 py-0.5 rounded-full text-[var(--muted)]">
                {tabCounts[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'boxys' && (
        <BoxysTab
          campaign={campaign}
          advertisements={advertisements}
          social_creatives={social_creatives}
          landing_pages={landing_pages}
          localCreatives={localCreatives}
        />
      )}
      {tab === 'creatives' && localCampaignId && (
        <CreativesTab campaignId={localCampaignId} creatives={localCreatives} copies={localCopies} boxysCampaignId={campaign.id} />
      )}
      {tab === 'copies' && localCampaignId && (
        <CopiesTab campaignId={localCampaignId} copies={localCopies} />
      )}
      {tab === 'carousels' && localCampaignId && (
        <CarouselsTab campaignId={localCampaignId} carousels={localCarousels} creatives={localCreatives} />
      )}
      {tab === 'search' && localCampaignId && (
        <SearchTab campaignId={localCampaignId} />
      )}
      {tab === 'export' && localCampaignId && (
        <ExportTab campaignId={localCampaignId} creatives={localCreatives} carousels={localCarousels} copies={localCopies} />
      )}
      {!localCampaignId && tab !== 'boxys' && (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--line)]">
          <p className="font-semibold text-sm text-[var(--ink-soft)]">Nenhuma campanha local vinculada</p>
          <p className="text-xs text-[var(--muted)] mt-2">Esta campanha Boxys não tem uma campanha local associada.</p>
        </div>
      )}
    </>
  )
}
