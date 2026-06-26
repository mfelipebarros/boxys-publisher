import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { LocalCampaign, LocalCopy, PaidTrafficInfoComplete } from '../../types/index.ts'
import PaidTrafficReal from './traffic/PaidTrafficReal'
import { LoginMetaButton } from '../LoginMetaButton'
import { LoginGoogleAdsButton } from '../LoginGoogleAdsButton'

interface Props {
  campaignId: string
  campaign: LocalCampaign
  copies?: LocalCopy[]
}

export function TrafegoPagoTab({ campaignId, campaign, copies = [] }: Props) {
  const qc = useQueryClient()
  const [publishing, setPublishing] = useState(false)
  const [publishStatus, setPublishStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [publishError, setPublishError] = useState<string | null>(null)

  const initialData = (() => {
    let data: PaidTrafficInfoComplete | undefined
    if (campaign.traffic_config) {
      try { data = JSON.parse(campaign.traffic_config) } catch { /* ignore */ }
    }

    // Auto-populate Google Search titles/descriptions from search copies if fields are empty
    const searchCopy = copies.find(c => c.type === 'search')
    if (searchCopy) {
      const googleSearch = data?.googleInfo?.search
      const titlesEmpty = !googleSearch?.titles?.trim()
      const descsEmpty = !googleSearch?.descriptions?.trim()

      if (titlesEmpty || descsEmpty) {
        data = {
          ...(data ?? { generalInfos: { objective: 'OUTCOME_LEADS', gender: 'all', budget: 600, min_age: 18, max_age: 65 }, audienceGroups: [], locations: [] } as any),
          googleInfo: {
            activeType: 'search',
            ...(data?.googleInfo ?? {}),
            search: {
              ...(data?.googleInfo?.search ?? {}),
              titles: titlesEmpty ? (searchCopy.title?.trim() ?? '') : (googleSearch?.titles ?? ''),
              descriptions: descsEmpty ? (searchCopy.description?.trim() ?? '') : (googleSearch?.descriptions ?? ''),
            } as any,
          },
        }
      }
    }

    return data as PaidTrafficInfoComplete | undefined
  })()

  const handleSubmit = useCallback(async (data: PaidTrafficInfoComplete) => {
    await api.put(`/api/campaigns/${campaignId}`, {
      traffic_config: JSON.stringify(data),
    })
    qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] })
  }, [campaignId, qc])

  const handlePublish = async () => {
    setPublishing(true)
    setPublishStatus('idle')
    setPublishError(null)
    try {
      await api.post(`/api/boxys/publish-traffic`, { local_campaign_id: Number(campaignId) })
      setPublishStatus('ok')
    } catch (err: unknown) {
      setPublishStatus('error')
      setPublishError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--ink)]">Tráfego Pago</h2>
          <p className="text-xs text-[var(--muted)] mt-1">Configure Meta Ads e Google Ads para esta campanha.</p>
          <div className="mt-2 flex items-center gap-2">
            <LoginMetaButton />
            <LoginGoogleAdsButton />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handlePublish}
            disabled={publishing || !campaign.boxys_campaign_id}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {publishing ? 'Publicando…' : 'Publicar no Boxys'}
          </button>
          {publishStatus === 'ok' && (
            <span className="text-xs text-green-400">Publicado com sucesso!</span>
          )}
          {publishStatus === 'error' && (
            <span className="text-xs text-red-400">{publishError}</span>
          )}
          {!campaign.boxys_campaign_id && (
            <span className="text-xs text-[var(--muted)]">Campanha não vinculada ao Boxys</span>
          )}
        </div>
      </div>
      <PaidTrafficReal
        onNextStep={() => {}}
        onPreviousStep={() => {}}
        onSubmit={handleSubmit}
        initialData={initialData}
        campaignId={Number(campaignId)}
      />
    </div>
  )
}
