import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Button } from '../components/ui/Button'
import { BriefingTab } from '../components/campaign/BriefingTab'
import { CopiesTab } from '../components/campaign/CopiesTab'
import { LandingPageTab } from '../components/campaign/LandingPageTab'
import { BannersTab } from '../components/campaign/BannersTab'
import { CarouselsTab } from '../components/campaign/CarouselsTab'
import { VideosTab } from '../components/campaign/VideosTab'
import { IATab } from '../components/campaign/IATab'
import { DescricoesTab } from '../components/campaign/DescricoesTab'
import { DesignTab } from '../components/campaign/DesignTab'
import { PublicarTab } from '../components/campaign/PublicarTab'
import { TrafegoPagoTab } from '../components/campaign/TrafegoPagoTab'
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

const TABS = [
  { key: 'briefing', label: 'Briefing' },
  { key: 'copies', label: 'Copy' },
  { key: 'landing-page', label: 'Landing Page' },
  { key: 'banners', label: 'Banners' },
  { key: 'carousels', label: 'Carrosseis' },
  { key: 'videos', label: 'Videos' },
  { key: 'trafego', label: 'Tráfego Pago' },
  { key: 'ia', label: 'IA' },
  { key: 'descricoes', label: 'Descrições' },
  { key: 'design', label: 'Design' },
  { key: 'publicar', label: 'Publicar' },
] as const

type TabKey = typeof TABS[number]['key']

function StatusBadge({ published }: { published: boolean }) {
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
      published ? 'bg-green-900/50 text-green-400' : 'bg-[var(--surface-raised)] text-[var(--muted)]'
    }`}>
      {published ? 'Publicada' : 'Rascunho'}
    </span>
  )
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <span className="text-[var(--muted)] text-sm font-mono">Aguardando dados locais…</span>
    </div>
  )
}

export function BoxyCampaignPage() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<TabKey>('briefing')
  const qc = useQueryClient()
  const creatingLocal = useRef(false)

  // Boxys campaign data (Supabase)
  const { data, isLoading, error } = useQuery({
    queryKey: ['boxy-campaign', id],
    queryFn: () => api.get<CampaignDetailResponse>(`/api/boxys/campaigns/${id}`),
    enabled: !!id,
  })

  // All local campaigns — to find the linked one
  const { data: localList } = useQuery({
    queryKey: ['local-campaigns'],
    queryFn: () => api.get<{ campaigns: LocalCampaign[] }>('/api/campaigns'),
    staleTime: 30_000,
  })

  const linkedLocal = (localList?.campaigns ?? []).find(c => c.boxys_campaign_id === Number(id))

  // Auto-create local campaign linked to this Boxys campaign if none exists
  useEffect(() => {
    if (!data || !localList) return
    if (linkedLocal) return
    if (creatingLocal.current) return
    creatingLocal.current = true
    api.post<{ status: string; campaign: LocalCampaign }>('/api/campaigns', {
      name: data.campaign.title,
      boxys_campaign_id: data.campaign.id,
    }).then(() => {
      qc.invalidateQueries({ queryKey: ['local-campaigns'] })
    }).catch(console.error)
  }, [data, localList, linkedLocal, qc])

  // Local campaign detail (SQLite)
  const { data: localDetail } = useQuery({
    queryKey: ['local-campaign', String(linkedLocal?.id)],
    queryFn: () => api.get<LocalDetailResponse>(`/api/campaigns/${linkedLocal!.id}`),
    enabled: !!linkedLocal?.id,
  })

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
  const localCampaign = localDetail?.campaign ?? linkedLocal
  const localCampaignId = String(linkedLocal?.id ?? '')
  const creatives = localDetail?.creatives ?? []
  const copies = localDetail?.copies ?? []
  const carousels = localDetail?.carousels ?? []

  const banners = creatives.filter(c => c.type === 'html' || c.type === 'image')
  const videos = creatives.filter(c => c.type === 'video')
  const landingPages = creatives.filter(c => c.type === 'landing_page')

  const counts: Partial<Record<TabKey, number>> = {
    copies: copies.length,
    'landing-page': landingPages.length,
    banners: banners.length,
    carousels: carousels.length,
    videos: videos.length,
    publicar: advertisements.length + social_creatives.length + landing_pages.length,
  }

  // If local campaign isn't ready yet, show loading for data-dependent tabs
  const localReady = !!localCampaignId && !!localDetail

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="flex items-start gap-4">
          {campaign.image && (
            <img src={campaign.image} alt="" className="w-14 h-14 rounded-lg object-cover flex-none border border-[var(--line)]" />
          )}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-[var(--ink)]">{campaign.title}</h1>
              <StatusBadge published={campaign.published} />
            </div>
            <p className="text-xs text-[var(--muted)] font-mono">
              {advertisements.length} anúncio{advertisements.length !== 1 ? 's' : ''} ·{' '}
              {social_creatives.length} social{social_creatives.length !== 1 ? 's' : ''} ·{' '}
              {landing_pages.length} LP{landing_pages.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Link to="/"><Button variant="secondary">← Voltar</Button></Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 mb-8 border-b border-[var(--line)] overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap ${
              tab === t.key
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink-soft)]'
            }`}
          >
            {t.label}
            {counts[t.key] !== undefined && (
              <span className="text-[10px] font-mono bg-[var(--surface-raised)] px-1.5 py-0.5 rounded-full text-[var(--muted)]">
                {counts[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'briefing' && (
        localReady && localCampaign
          ? <BriefingTab campaignId={localCampaignId} campaign={localCampaign} />
          : <Loading />
      )}
      {tab === 'copies' && (
        localReady
          ? <CopiesTab campaignId={localCampaignId} copies={copies} />
          : <Loading />
      )}
      {tab === 'landing-page' && (
        localReady
          ? <LandingPageTab campaignId={localCampaignId} creatives={landingPages} copies={copies} />
          : <Loading />
      )}
      {tab === 'banners' && (
        localReady
          ? <BannersTab campaignId={localCampaignId} creatives={banners} copies={copies} boxysCampaignId={campaign.id} />
          : <Loading />
      )}
      {tab === 'carousels' && (
        localReady
          ? <CarouselsTab campaignId={localCampaignId} carousels={carousels} />
          : <Loading />
      )}
      {tab === 'videos' && (
        localReady
          ? <VideosTab campaignId={localCampaignId} creatives={videos} copies={copies} boxysCampaignId={campaign.id} />
          : <Loading />
      )}
      {tab === 'ia' && (
        localReady && localCampaign
          ? <IATab campaignId={localCampaignId} campaign={localCampaign} />
          : <Loading />
      )}
      {tab === 'descricoes' && (
        localReady && localCampaign
          ? <DescricoesTab campaignId={localCampaignId} campaign={localCampaign} />
          : <Loading />
      )}
      {tab === 'design' && (
        localReady && localCampaign
          ? <DesignTab campaignId={localCampaignId} campaign={localCampaign} />
          : <Loading />
      )}
      {tab === 'publicar' && (
        localReady && localCampaign
          ? <PublicarTab
              campaignId={localCampaignId}
              campaign={localCampaign}
              banners={banners}
              videos={videos}
              carousels={carousels}
              boxysCampaignId={campaign.id}
              advertisements={advertisements}
              social_creatives={social_creatives}
              landing_pages={landing_pages}
            />
          : <Loading />
      )}
      {tab === 'trafego' && (
        localReady && localCampaign
          ? <TrafegoPagoTab campaignId={localCampaignId} campaign={localCampaign} copies={copies} />
          : <Loading />
      )}
    </>
  )
}
