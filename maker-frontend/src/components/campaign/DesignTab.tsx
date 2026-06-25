import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { LocalCampaign, VersoConfig } from '../../types'

// --- Color utilities (mirrored from Boxys frontend) ---
function hexToRgb(hex: string) {
  const clean = hex.replace('#', '').padEnd(6, '0')
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  }
}

function colorLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const toLinear = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function mixWithBlack(hex: string, ratio: number) {
  const { r, g, b } = hexToRgb(hex)
  return `rgb(${Math.round(r * (1 - ratio))}, ${Math.round(g * (1 - ratio))}, ${Math.round(b * (1 - ratio))})`
}

function textColorsForBg(campaignColor: string) {
  const isLight = colorLuminance(campaignColor) > 0.179
  return {
    title: isLight ? '#101114' : '#ffffff',
    oneLiner: isLight ? '#1a1f2e' : '#ffffff',
    description: isLight ? '#6B7280' : '#d1d5db',
    gradientEnd: isLight ? '#ffffff' : mixWithBlack(campaignColor, 0.42),
  }
}

// --- Card Back Preview ---
function CardBackPreview({
  verso,
  imageUrl,
  title,
}: {
  verso: VersoConfig
  imageUrl?: string | null
  title?: string | null
}) {
  const campaignColor = verso.campaign_color ?? '#2563EB'
  const colors = textColorsForBg(campaignColor)
  const miniCardBg = 'rgba(255,255,255,0.62)'
  const miniCardLabel = '#6B7280'
  const miniCardValue = '#111827'

  const hasType = !!verso.campaign_type
  const hasProfile = !!verso.broker_profile
  const hasLead = !!verso.lead_cost?.trim()
  const hasInfoItems = hasType || hasProfile || hasLead

  return (
    <div
      className="relative w-full rounded-xl shadow-xl overflow-hidden"
      style={{
        aspectRatio: '4/5',
        background: `linear-gradient(145deg, ${campaignColor} 0%, ${colors.gradientEnd} 100%)`,
      }}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: 'blur(12px)', opacity: 0.35, transform: 'scale(1.1)' }}
        />
      )}
      <div className="relative z-10 flex flex-col justify-between gap-4 p-5 h-full">
        <div>
          {title && (
            <h3 className="text-xl font-semibold leading-tight line-clamp-2" style={{ color: colors.title }}>
              {title}
            </h3>
          )}
          {verso.one_liner && (
            <p
              className={`mt-2.5 font-semibold leading-snug ${!hasInfoItems ? 'text-xl' : 'text-base'}`}
              style={{ color: colors.oneLiner }}
            >
              {verso.one_liner}
            </p>
          )}
          {verso.clear_description && hasInfoItems && (
            <p className="mt-2 text-xs leading-relaxed" style={{ color: colors.description }}>
              {verso.clear_description}
            </p>
          )}
        </div>

        {!hasInfoItems ? (
          verso.clear_description && (
            <p className="text-base leading-relaxed" style={{ color: colors.description }}>
              {verso.clear_description}
            </p>
          )
        ) : (
          <div className="space-y-2">
            {(hasType || hasProfile) && (
              <div className="grid grid-cols-2 gap-2">
                {hasType && (
                  <div className="min-w-0 rounded-lg px-3 py-2" style={{ background: miniCardBg }}>
                    <p className="text-[10px] font-medium leading-tight uppercase tracking-wide" style={{ color: miniCardLabel }}>Tipo</p>
                    <p className="mt-0.5 text-xs font-semibold leading-snug line-clamp-1" style={{ color: miniCardValue }}>{verso.campaign_type}</p>
                  </div>
                )}
                {hasProfile && (
                  <div className="min-w-0 rounded-lg px-3 py-2" style={{ background: miniCardBg }}>
                    <p className="text-[10px] font-medium leading-tight uppercase tracking-wide" style={{ color: miniCardLabel }}>Corretor</p>
                    <p className="mt-0.5 text-xs font-semibold leading-snug line-clamp-1" style={{ color: miniCardValue }}>{verso.broker_profile}</p>
                  </div>
                )}
              </div>
            )}
            {hasLead && (
              <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ background: miniCardBg }}>
                <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: miniCardLabel }}>Custo por lead</span>
                <span className="shrink-0 text-xs font-semibold" style={{ color: miniCardValue }}>{verso.lead_cost}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface Props {
  campaignId: string
  campaign: LocalCampaign
}

function parseVersoConfig(raw: string | null | undefined): VersoConfig {
  try {
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

const inputCls =
  'w-full bg-[var(--surface)] border border-[var(--line)] rounded-lg px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors'

function ImageUploadSlot({
  label,
  hint,
  currentUrl,
  field,
  campaignId,
  onUploaded,
}: {
  label: string
  hint: string
  currentUrl?: string | null
  field: 'thumb_url' | 'featured_image_url'
  campaignId: string
  onUploaded: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('field', field)
      const res = await api.upload(`/api/campaigns/${campaignId}/images`, fd) as { url?: string }
      if (res?.url) onUploaded(res.url)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">{label}</label>
      <p className="text-xs text-[var(--muted)] mb-2">{hint}</p>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        className="relative cursor-pointer rounded-[var(--radius)] border-2 border-dashed border-[var(--line)] hover:border-[var(--muted)] transition-colors overflow-hidden"
        style={{ minHeight: 120 }}
      >
        {currentUrl ? (
          <img src={currentUrl} alt="" className="w-full object-cover" style={{ maxHeight: 200 }} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-8 text-[var(--muted)]">
            <span className="text-2xl mb-1">📷</span>
            <span className="text-xs">{uploading ? 'Enviando…' : 'Clique para enviar'}</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white text-xs">Enviando…</span>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  )
}

export function DesignTab({ campaignId, campaign }: Props) {
  const qc = useQueryClient()
  const [thumbUrl, setThumbUrl] = useState(campaign.thumb_url ?? '')
  const [featuredUrl, setFeaturedUrl] = useState(campaign.featured_image_url ?? '')
  const [verso, setVerso] = useState<VersoConfig>(() => parseVersoConfig(campaign.verso_config))
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setThumbUrl(campaign.thumb_url ?? '')
    setFeaturedUrl(campaign.featured_image_url ?? '')
    setVerso(parseVersoConfig(campaign.verso_config))
  }, [campaign.thumb_url, campaign.featured_image_url, campaign.verso_config])

  const saveMut = useMutation({
    mutationFn: () =>
      api.put(`/api/campaigns/${campaignId}`, { verso_config: JSON.stringify(verso) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  function setV(field: keyof VersoConfig, value: string) {
    setVerso(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="flex gap-8 items-start">
      {/* Left: form */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold text-[var(--ink)]">Design</h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Imagens e configuração do verso da campanha.
            </p>
          </div>
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            className="text-xs font-semibold px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saveMut.isPending ? 'Salvando…' : saved ? 'Salvo ✓' : 'Salvar verso'}
          </button>
        </div>

        <div className="flex flex-col gap-6">
          {/* Images */}
          <div className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--line)] p-4">
            <h3 className="text-xs font-bold text-[var(--ink)] mb-4 uppercase tracking-wide">Imagens</h3>
            <div className="grid grid-cols-2 gap-4">
              <ImageUploadSlot
                label="Thumbnail (capa)"
                hint="Aparece nos cards de campanha."
                currentUrl={thumbUrl}
                field="thumb_url"
                campaignId={campaignId}
                onUploaded={url => { setThumbUrl(url); qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] }) }}
              />
              <ImageUploadSlot
                label="Imagem destacada"
                hint="Formato horizontal para a home."
                currentUrl={featuredUrl}
                field="featured_image_url"
                campaignId={campaignId}
                onUploaded={url => { setFeaturedUrl(url); qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] }) }}
              />
            </div>
          </div>

          {/* Verso */}
          <div className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--line)] p-4">
            <h3 className="text-xs font-bold text-[var(--ink)] mb-4 uppercase tracking-wide">Verso da campanha</h3>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Cor da campanha</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={verso.campaign_color ?? '#2563EB'}
                    onChange={e => setV('campaign_color', e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-[var(--line)]"
                  />
                  <input
                    value={verso.campaign_color ?? '#2563EB'}
                    onChange={e => setV('campaign_color', e.target.value)}
                    placeholder="#2563EB"
                    className={`${inputCls} font-mono text-xs`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Frase da campanha (one-liner)</label>
                <input
                  value={verso.one_liner ?? ''}
                  onChange={e => setV('one_liner', e.target.value)}
                  placeholder="Uma frase que resume o diferencial da campanha"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Tipo de campanha</label>
                  <input
                    value={verso.campaign_type ?? ''}
                    onChange={e => setV('campaign_type', e.target.value)}
                    placeholder="ex: lançamento"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Perfil de corretor</label>
                  <input
                    value={verso.broker_profile ?? ''}
                    onChange={e => setV('broker_profile', e.target.value)}
                    placeholder="ex: consultivo"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Custo por lead</label>
                <input
                  value={verso.lead_cost ?? ''}
                  onChange={e => setV('lead_cost', e.target.value)}
                  placeholder="ex: R$ 45,00"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Descrição clara</label>
                <textarea
                  value={verso.clear_description ?? ''}
                  onChange={e => setV('clear_description', e.target.value)}
                  placeholder="Leitura comercial dos diferenciais e contexto da campanha."
                  rows={4}
                  className={`${inputCls} resize-y`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: live preview */}
      <div className="w-56 shrink-0 sticky top-6">
        <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide mb-3">Verso — preview</p>
        <CardBackPreview
          verso={verso}
          imageUrl={thumbUrl || null}
          title={campaign.campaign_title || campaign.name}
        />
      </div>
    </div>
  )
}
