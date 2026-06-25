import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Button } from '../components/ui/Button'
import { CreativesTab } from '../components/campaign/CreativesTab'
import { CopiesTab } from '../components/campaign/CopiesTab'
import { CarouselsTab } from '../components/campaign/CarouselsTab'
import { ExportTab } from '../components/campaign/ExportTab'
import { SearchTab } from '../components/campaign/SearchTab'
import type { LocalCampaign, LocalCreative, LocalCopy, LocalCarousel } from '../types'

interface LocalCampaignDetailResponse {
  campaign: LocalCampaign
  creatives: LocalCreative[]
  copies: LocalCopy[]
  carousels: LocalCarousel[]
}

const TABS = [
  { key: 'creatives', label: 'Criativos' },
  { key: 'copies', label: 'Copies' },
  { key: 'carousels', label: 'Carrosseis' },
  { key: 'search', label: 'Search Ads' },
  { key: 'export', label: 'Export ZIP' },
] as const

type TabKey = typeof TABS[number]['key']

export function LocalCampaignPage() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<TabKey>('creatives')

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

  const counts: Record<TabKey, number | undefined> = {
    creatives: creatives.length,
    copies: copies.length,
    carousels: carousels.length,
    search: undefined,
    export: undefined,
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
            {counts[t.key] !== undefined && (
              <span className="text-[10px] font-mono bg-[var(--surface-raised)] px-1.5 py-0.5 rounded-full text-[var(--muted)]">
                {counts[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'creatives' && (
        <CreativesTab campaignId={id!} creatives={creatives} copies={copies} boxysCampaignId={campaign.boxys_campaign_id} />
      )}
      {tab === 'copies' && (
        <CopiesTab campaignId={id!} copies={copies} />
      )}
      {tab === 'carousels' && (
        <CarouselsTab campaignId={id!} carousels={carousels} creatives={creatives} />
      )}
      {tab === 'search' && (
        <SearchTab campaignId={id!} />
      )}
      {tab === 'export' && (
        <ExportTab
          campaignId={id!}
          creatives={creatives}
          carousels={carousels}
          copies={copies}
        />
      )}
    </>
  )
}
