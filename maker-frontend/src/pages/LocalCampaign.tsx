import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
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
import { SearchTab } from '../components/campaign/SearchTab'
import type { LocalCampaign, LocalCreative, LocalCopy, LocalCarousel } from '../types'

interface LocalCampaignDetailResponse {
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
  { key: 'ia', label: 'IA' },
  { key: 'descricoes', label: 'Descrições' },
  { key: 'design', label: 'Design' },
  { key: 'publicar', label: 'Publicar' },
  { key: 'search', label: 'Search Ads' },
] as const

type TabKey = typeof TABS[number]['key']

export function LocalCampaignPage() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<TabKey>('briefing')

  const { data, isLoading, error } = useQuery({
    queryKey: ['local-campaign', id],
    queryFn: () => api.get<LocalCampaignDetailResponse>(`/api/campaigns/${id}`),
    enabled: !!id,
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

  const { campaign, creatives = [], copies = [], carousels = [] } = data

  const banners = creatives.filter(c => c.type === 'html' || c.type === 'image')
  const videos = creatives.filter(c => c.type === 'video')
  const landingPages = creatives.filter(c => c.type === 'landing_page')

  const counts: Partial<Record<TabKey, number>> = {
    copies: copies.length,
    'landing-page': landingPages.length,
    banners: banners.length,
    carousels: carousels.length,
    videos: videos.length,
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">{campaign.name}</h1>
          <p className="text-xs text-[var(--muted)] font-mono mt-1">
            {campaign.figma_file_key
              ? `Figma: ${campaign.figma_file_key.slice(0, 8)}…`
              : 'Sem Figma'
            }
          </p>
        </div>
        <Link to="/">
          <Button variant="secondary">← Voltar</Button>
        </Link>
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
        <BriefingTab campaignId={id!} campaign={campaign} />
      )}
      {tab === 'copies' && (
        <CopiesTab campaignId={id!} copies={copies} />
      )}
      {tab === 'landing-page' && (
        <LandingPageTab campaignId={id!} creatives={landingPages} copies={copies} />
      )}
      {tab === 'banners' && (
        <BannersTab campaignId={id!} creatives={banners} copies={copies} boxysCampaignId={campaign.boxys_campaign_id} />
      )}
      {tab === 'carousels' && (
        <CarouselsTab campaignId={id!} carousels={carousels} />
      )}
      {tab === 'videos' && (
        <VideosTab campaignId={id!} creatives={videos} copies={copies} boxysCampaignId={campaign.boxys_campaign_id} />
      )}
      {tab === 'ia' && (
        <IATab campaignId={id!} campaign={campaign} />
      )}
      {tab === 'descricoes' && (
        <DescricoesTab campaignId={id!} campaign={campaign} />
      )}
      {tab === 'design' && (
        <DesignTab campaignId={id!} campaign={campaign} />
      )}
      {tab === 'publicar' && (
        <PublicarTab
          campaignId={id!}
          campaign={campaign}
          banners={banners}
          videos={videos}
          carousels={carousels}
        />
      )}
      {tab === 'search' && (
        <SearchTab campaignId={id!} />
      )}
    </>
  )
}
