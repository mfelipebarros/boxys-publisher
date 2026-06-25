import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { LocalCampaign } from '../../types'

interface Props {
  campaignId: string
  campaign: LocalCampaign
}

export function BriefingTab({ campaignId, campaign }: Props) {
  const qc = useQueryClient()
  const [text, setText] = useState(campaign.briefing_text ?? '')
  const [saved, setSaved] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveMut = useMutation({
    mutationFn: (value: string) =>
      api.put(`/api/campaigns/${campaignId}`, { briefing_text: value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  useEffect(() => {
    setText(campaign.briefing_text ?? '')
  }, [campaign.briefing_text])

  function handleChange(value: string) {
    setText(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => saveMut.mutate(value), 1000)
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--ink)]">Briefing</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Contexto geral da campanha — produto, público, objetivos, regras, referências.
          </p>
        </div>
        {saved && (
          <span className="text-xs text-[var(--green,#22c55e)] font-medium">Salvo ✓</span>
        )}
      </div>

      <textarea
        value={text}
        onChange={e => handleChange(e.target.value)}
        placeholder="Descreva o produto, público-alvo, diferenciais, objeções, regras de atendimento, benchmarks, referências criativas, objetivos de mídia e qualquer contexto relevante para a campanha…"
        className="w-full min-h-[480px] bg-[var(--surface)] border border-[var(--line)] rounded-[var(--radius)] px-4 py-3 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] resize-y focus:outline-none focus:border-[var(--accent)] transition-colors leading-relaxed"
      />
    </div>
  )
}
