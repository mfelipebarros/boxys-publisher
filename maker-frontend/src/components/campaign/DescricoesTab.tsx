import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { LocalCampaign } from '../../types'

interface Props {
  campaignId: string
  campaign: LocalCampaign
}

interface FormState {
  campaign_title: string
  general_description: string
  basic_copy: string
  explanation_video_url: string
  traffic_video_url: string
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">{label}</label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full bg-[var(--surface)] border border-[var(--line)] rounded-lg px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors'

export function DescricoesTab({ campaignId, campaign }: Props) {
  const qc = useQueryClient()
  const [form, setForm] = useState<FormState>({
    campaign_title: campaign.campaign_title ?? '',
    general_description: campaign.general_description ?? '',
    basic_copy: campaign.basic_copy ?? '',
    explanation_video_url: campaign.explanation_video_url ?? '',
    traffic_video_url: campaign.traffic_video_url ?? '',
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setForm({
      campaign_title: campaign.campaign_title ?? '',
      general_description: campaign.general_description ?? '',
      basic_copy: campaign.basic_copy ?? '',
      explanation_video_url: campaign.explanation_video_url ?? '',
      traffic_video_url: campaign.traffic_video_url ?? '',
    })
  }, [
    campaign.campaign_title,
    campaign.general_description,
    campaign.basic_copy,
    campaign.explanation_video_url,
    campaign.traffic_video_url,
  ])

  const saveMut = useMutation({
    mutationFn: (data: FormState) => api.put(`/api/campaigns/${campaignId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  function set(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-[var(--ink)]">Descrições</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Informações textuais e links da campanha.
          </p>
        </div>
        <button
          onClick={() => saveMut.mutate(form)}
          disabled={saveMut.isPending}
          className="text-xs font-semibold px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saveMut.isPending ? 'Salvando…' : saved ? 'Salvo ✓' : 'Salvar'}
        </button>
      </div>

      <div className="flex flex-col gap-5">
        <Field label="Título da campanha">
          <input
            value={form.campaign_title}
            onChange={e => set('campaign_title', e.target.value)}
            placeholder="Nome comercial da campanha"
            className={inputCls}
          />
        </Field>

        <Field label="Descrição geral">
          <textarea
            value={form.general_description}
            onChange={e => set('general_description', e.target.value)}
            placeholder="Descreva o objetivo e o tema principal da campanha."
            rows={4}
            className={`${inputCls} resize-y`}
          />
        </Field>

        <Field label="Copy básica">
          <textarea
            value={form.basic_copy}
            onChange={e => set('basic_copy', e.target.value)}
            placeholder="Copy de uso pelos corretores — argumentação, benefícios, diferenciais."
            rows={5}
            className={`${inputCls} resize-y`}
          />
        </Field>

        <div className="h-px bg-[var(--line)]" />

        <Field label="Link de vídeo de explicação">
          <input
            type="url"
            value={form.explanation_video_url}
            onChange={e => set('explanation_video_url', e.target.value)}
            placeholder="https://…"
            className={inputCls}
          />
        </Field>

        <Field label="Link de vídeo de tráfego">
          <input
            type="url"
            value={form.traffic_video_url}
            onChange={e => set('traffic_video_url', e.target.value)}
            placeholder="https://…"
            className={inputCls}
          />
        </Field>
      </div>
    </div>
  )
}
