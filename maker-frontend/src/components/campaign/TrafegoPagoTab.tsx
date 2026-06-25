import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { LocalCampaign, LocalCopy, PaidTrafficInfoComplete } from '../../types/index.ts'
import PaidTrafficReal from './traffic/PaidTrafficReal'

interface Props {
  campaignId: string
  campaign: LocalCampaign
  copies?: LocalCopy[]
}

export function TrafegoPagoTab({ campaignId, campaign, copies = [] }: Props) {
  const qc = useQueryClient()

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

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--ink)]">Tráfego Pago</h2>
        <p className="text-xs text-[var(--muted)] mt-1">Configure Meta Ads e Google Ads para esta campanha.</p>
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
