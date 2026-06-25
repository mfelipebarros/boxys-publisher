import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { LocalCampaign, IAConfig } from '../../types'

interface Props {
  campaignId: string
  campaign: LocalCampaign
}

function parseIAConfig(raw: string | null | undefined): IAConfig {
  try {
    if (raw) return JSON.parse(raw)
  } catch {}
  return {
    abordagem: { enabled: false, context: '' },
    trafego: { enabled: false, context: '' },
  }
}

interface SofiaCardProps {
  title: string
  subtitle: string
  accentColor: string
  enabled: boolean
  context: string
  onEnabledChange: (v: boolean) => void
  onContextChange: (v: string) => void
}

function SofiaCard({
  title,
  subtitle,
  accentColor,
  enabled,
  context,
  onEnabledChange,
  onContextChange,
}: SofiaCardProps) {
  return (
    <div className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--line)] overflow-hidden">
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ background: accentColor }}
      >
        <div>
          <p className="font-bold text-white text-sm">{title}</p>
          <p className="text-white/70 text-xs mt-0.5">{subtitle}</p>
        </div>
        <button
          onClick={() => onEnabledChange(!enabled)}
          className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${
            enabled ? 'bg-white/30' : 'bg-black/20'
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
              enabled ? 'left-5' : 'left-1'
            }`}
          />
        </button>
      </div>

      {/* Context input */}
      <div className="p-4">
        <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">
          Contexto / Prompt
        </label>
        <textarea
          value={context}
          onChange={e => onContextChange(e.target.value)}
          disabled={!enabled}
          rows={8}
          placeholder={
            title.includes('Abordagem')
              ? 'Descreva produto, público, diferenciais, objeções, regras de atendimento e scripts aprovados.'
              : 'Descreva objetivo de mídia, configuração atual, público, orçamento planejado, criativos e observações relevantes.'
          }
          className="w-full bg-[var(--surface-raised)] border border-[var(--line)] rounded-lg px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] resize-y focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-40 leading-relaxed"
        />
      </div>
    </div>
  )
}

export function IATab({ campaignId, campaign }: Props) {
  const qc = useQueryClient()
  const [config, setConfig] = useState<IAConfig>(() => parseIAConfig(campaign.ia_config))
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setConfig(parseIAConfig(campaign.ia_config))
  }, [campaign.ia_config])

  const saveMut = useMutation({
    mutationFn: (cfg: IAConfig) =>
      api.put(`/api/campaigns/${campaignId}`, { ia_config: JSON.stringify(cfg) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  function updateAbordagem(patch: Partial<IAConfig['abordagem']>) {
    const next = { ...config, abordagem: { ...config.abordagem, ...patch } }
    setConfig(next)
  }

  function updateTrafego(patch: Partial<IAConfig['trafego']>) {
    const next = { ...config, trafego: { ...config.trafego, ...patch } }
    setConfig(next)
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-[var(--ink)]">Prompts da Sofia</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Configure os contextos para a Sofia Abordagem e Sofia Tráfego.
          </p>
        </div>
        <button
          onClick={() => saveMut.mutate(config)}
          disabled={saveMut.isPending}
          className="text-xs font-semibold px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saveMut.isPending ? 'Salvando…' : saved ? 'Salvo ✓' : 'Salvar'}
        </button>
      </div>

      <div className="flex flex-col gap-5">
        <SofiaCard
          title="Sofia Abordagem"
          subtitle="Chat de vendas e atendimento ao cliente"
          accentColor="#3b82f6"
          enabled={config.abordagem.enabled}
          context={config.abordagem.context}
          onEnabledChange={v => updateAbordagem({ enabled: v })}
          onContextChange={v => updateAbordagem({ context: v })}
        />
        <SofiaCard
          title="Sofia Tráfego"
          subtitle="Assistente de mídia e tráfego pago"
          accentColor="#FF1868"
          enabled={config.trafego.enabled}
          context={config.trafego.context}
          onEnabledChange={v => updateTrafego({ enabled: v })}
          onContextChange={v => updateTrafego({ context: v })}
        />
      </div>
    </div>
  )
}
