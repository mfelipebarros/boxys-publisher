import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { VISUAL_RATING_LABELS } from '../../types'
import type { LocalCampaign, VersoConfig, CardBackLayout } from '../../types'

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

// Resolve todas as cores do verso (overrides do usuário + defaults por luminância),
// espelhando exatamente a lógica do CampaignFlipCard da Boxys.
function resolveVersoColors(verso: VersoConfig) {
  const campaignColor = verso.campaign_color || '#2563EB'
  const isLight = colorLuminance(campaignColor) > 0.179
  return {
    campaignColor,
    gradientEnd: verso.gradient_end_color || (isLight ? '#ffffff' : mixWithBlack(campaignColor, 0.42)),
    title: verso.title_color || (isLight ? '#101114' : '#ffffff'),
    oneLiner: verso.one_liner_color || (isLight ? '#1a1f2e' : '#ffffff'),
    description: verso.description_color || (isLight ? '#6B7280' : 'rgba(255,255,255,0.58)'),
    miniCardBg: verso.mini_card_bg_color || 'rgba(255,255,255,0.62)',
    miniCardLabel: verso.mini_card_label_color || '#6B7280',
    miniCardValue: verso.mini_card_value_color || '#111827',
    star: verso.star_color || campaignColor,
  }
}

function Stars({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} className="leading-none text-[11px]" style={{ color: s <= Math.min(value, 5) ? color : 'rgba(17,24,39,0.18)' }}>★</span>
      ))}
    </div>
  )
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
  const c = resolveVersoColors(verso)
  const layout: CardBackLayout = verso.card_back_layout === 'lines' ? 'lines' : 'grid'
  const showBackdrop = verso.use_image_backdrop === true && !!imageUrl

  const hasType = !!verso.campaign_type
  const hasProfile = !!verso.broker_profile
  const hasLead = !!verso.lead_cost?.trim()
  const visibleRatings = VISUAL_RATING_LABELS
    .map(label => ({ label, value: verso.ratings?.[label] ?? 0 }))
    .filter(r => r.value > 0)
  const hasInfoItems = hasType || hasProfile || hasLead || visibleRatings.length > 0

  const miniStyle = { background: c.miniCardBg }

  return (
    <div
      className="relative w-full rounded-xl shadow-xl overflow-hidden"
      style={{ aspectRatio: '4/5', background: `linear-gradient(145deg, ${c.campaignColor} 0%, ${c.gradientEnd} 100%)` }}
    >
      {showBackdrop && (
        <img src={imageUrl!} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: 'blur(12px)', opacity: 0.35, transform: 'scale(1.1)' }} />
      )}
      <div className="relative z-10 flex flex-col justify-between gap-4 p-4 h-full">
        <div>
          {title && <h3 className="text-base font-semibold leading-tight line-clamp-2" style={{ color: c.title }}>{title}</h3>}
          {verso.one_liner && (
            <p className={`mt-2 font-semibold leading-snug ${!hasInfoItems ? 'text-base' : 'text-sm'}`} style={{ color: c.oneLiner }}>{verso.one_liner}</p>
          )}
          {verso.clear_description && (
            <p className="mt-2 text-[11px] leading-relaxed" style={{ color: c.description }}>{verso.clear_description}</p>
          )}
        </div>

        {hasInfoItems && (
          layout === 'grid' ? (
            <div className="flex flex-col gap-1.5">
              {(hasType || hasProfile) && (
                <div className="grid grid-cols-2 gap-1.5">
                  {hasType && (
                    <div className="min-w-0 rounded-lg px-2 py-1.5" style={miniStyle}>
                      <p className="text-[9px] font-medium uppercase tracking-wide" style={{ color: c.miniCardLabel }}>Tipo</p>
                      <p className="text-[11px] font-semibold leading-snug line-clamp-1" style={{ color: c.miniCardValue }}>{verso.campaign_type}</p>
                    </div>
                  )}
                  {hasProfile && (
                    <div className="min-w-0 rounded-lg px-2 py-1.5" style={miniStyle}>
                      <p className="text-[9px] font-medium uppercase tracking-wide" style={{ color: c.miniCardLabel }}>Corretor</p>
                      <p className="text-[11px] font-semibold leading-snug line-clamp-1" style={{ color: c.miniCardValue }}>{verso.broker_profile}</p>
                    </div>
                  )}
                </div>
              )}
              {hasLead && (
                <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5" style={miniStyle}>
                  <span className="text-[9px] font-medium uppercase tracking-wide" style={{ color: c.miniCardLabel }}>Custo por lead</span>
                  <span className="text-[11px] font-semibold" style={{ color: c.miniCardValue }}>{verso.lead_cost}</span>
                </div>
              )}
              {visibleRatings.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5">
                  {visibleRatings.map(r => (
                    <div key={r.label} className="min-w-0 rounded-lg px-2 py-1.5 flex flex-col gap-0.5" style={miniStyle}>
                      <span className="text-[9px] font-medium leading-tight" style={{ color: c.miniCardLabel }}>{r.label}</span>
                      <Stars value={r.value} color={c.star} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {hasType && <Line label="Tipo" value={verso.campaign_type!} c={c} />}
              {hasProfile && <Line label="Corretor" value={verso.broker_profile!} c={c} />}
              {hasLead && <Line label="Custo por lead" value={verso.lead_cost!} c={c} />}
              {visibleRatings.map(r => (
                <div key={r.label} className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: c.miniCardLabel }}>{r.label}</span>
                  <Stars value={r.value} color={c.star} />
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}

function Line({ label, value, c }: { label: string; value: string; c: ReturnType<typeof resolveVersoColors> }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: c.miniCardLabel }}>{label}</span>
      <span className="text-[11px] font-semibold" style={{ color: c.miniCardValue }}>{value}</span>
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

// Linha de cor com override opcional (color picker + hex + reset para o default).
function ColorField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value?: string
  placeholder: string
  onChange: (v: string) => void
}) {
  // Color input nativo precisa de um hex válido; se o valor for rgba()/vazio, usa o placeholder.
  const swatch = value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : (/^#[0-9A-Fa-f]{6}$/.test(placeholder) ? placeholder : '#000000')
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={swatch} onChange={e => onChange(e.target.value)}
          className="w-7 h-7 rounded cursor-pointer border border-[var(--line)]" />
        <input value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={`auto (${placeholder})`}
          className={`${inputCls} font-mono text-xs`} />
        {value && (
          <button onClick={() => onChange('')} className="text-[var(--muted)] hover:text-[var(--ink)] text-xs px-1" title="Usar padrão">↺</button>
        )}
      </div>
    </div>
  )
}

export function DesignTab({ campaignId, campaign }: Props) {
  const qc = useQueryClient()
  const [thumbUrl, setThumbUrl] = useState(campaign.thumb_url ?? '')
  const [featuredUrl, setFeaturedUrl] = useState(campaign.featured_image_url ?? '')
  const [verso, setVerso] = useState<VersoConfig>(() => parseVersoConfig(campaign.verso_config))
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [saved, setSaved] = useState(false)
  const [synced, setSynced] = useState(false)

  useEffect(() => {
    setThumbUrl(campaign.thumb_url ?? '')
    setFeaturedUrl(campaign.featured_image_url ?? '')
    setVerso(parseVersoConfig(campaign.verso_config))
  }, [campaign.thumb_url, campaign.featured_image_url, campaign.verso_config])

  const saveMut = useMutation({
    mutationFn: () => api.put(`/api/campaigns/${campaignId}`, { verso_config: JSON.stringify(verso) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const syncMut = useMutation({
    mutationFn: () => api.post(`/api/campaigns/${campaignId}/sync-boxys`, {}),
    onSuccess: () => { setSynced(true); setTimeout(() => setSynced(false), 2500) },
  })

  function setV<K extends keyof VersoConfig>(field: K, value: VersoConfig[K]) {
    setVerso(prev => ({ ...prev, [field]: value }))
  }
  function setStr(field: keyof VersoConfig, value: string) {
    setVerso(prev => ({ ...prev, [field]: value }))
  }
  function setRating(label: string, value: number) {
    setVerso(prev => {
      const ratings = { ...(prev.ratings ?? {}) }
      // clicar na mesma estrela zera; senão define
      if (ratings[label] === value) delete ratings[label]
      else ratings[label] = value
      return { ...prev, ratings }
    })
  }

  return (
    <div className="flex gap-8 items-start">
      {/* Left: form */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold text-[var(--ink)]">Design</h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">Imagens e configuração do verso da campanha.</p>
          </div>
          <div className="flex items-center gap-2">
            {campaign.boxys_campaign_id && (
              <button
                onClick={() => syncMut.mutate()}
                disabled={syncMut.isPending}
                className="text-xs font-semibold px-3 py-1.5 border border-[var(--line)] text-[var(--ink-soft)] rounded-lg hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50 transition-all"
              >
                {syncMut.isPending ? 'Sincronizando…' : synced ? 'Sincronizado ✓' : 'Sincronizar com Boxys'}
              </button>
            )}
            <button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              className="text-xs font-semibold px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saveMut.isPending ? 'Salvando…' : saved ? 'Salvo ✓' : 'Salvar verso'}
            </button>
          </div>
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
                  <input type="color" value={verso.campaign_color ?? '#2563EB'} onChange={e => setStr('campaign_color', e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-[var(--line)]" />
                  <input value={verso.campaign_color ?? '#2563EB'} onChange={e => setStr('campaign_color', e.target.value)}
                    placeholder="#2563EB" className={`${inputCls} font-mono text-xs`} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Frase da campanha (one-liner)</label>
                <input value={verso.one_liner ?? ''} onChange={e => setStr('one_liner', e.target.value)}
                  placeholder="Uma frase que resume o diferencial da campanha" className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Tipo de campanha</label>
                  <input value={verso.campaign_type ?? ''} onChange={e => setStr('campaign_type', e.target.value)}
                    placeholder="ex: lançamento" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Perfil de corretor</label>
                  <input value={verso.broker_profile ?? ''} onChange={e => setStr('broker_profile', e.target.value)}
                    placeholder="ex: consultivo" className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Custo por lead</label>
                <input value={verso.lead_cost ?? ''} onChange={e => setStr('lead_cost', e.target.value)}
                  placeholder="ex: R$ 45,00" className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Descrição clara</label>
                <textarea value={verso.clear_description ?? ''} onChange={e => setStr('clear_description', e.target.value)}
                  placeholder="Leitura comercial dos diferenciais e contexto da campanha." rows={4} className={`${inputCls} resize-y`} />
              </div>

              {/* Ratings */}
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-2">Avaliações (estrelas)</label>
                <div className="grid grid-cols-2 gap-3">
                  {VISUAL_RATING_LABELS.map(label => {
                    const current = verso.ratings?.[label] ?? 0
                    return (
                      <div key={label} className="flex flex-col gap-1">
                        <span className="text-[11px] text-[var(--ink-soft)]">{label}</span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map(s => (
                            <button key={s} type="button" onClick={() => setRating(label, s)}
                              className="text-base leading-none transition-colors"
                              style={{ color: s <= current ? (verso.star_color || verso.campaign_color || '#2563EB') : 'var(--line)' }}
                              title={`${s} estrela${s > 1 ? 's' : ''}`}>★</button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Layout + backdrop */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Layout do verso</label>
                  <div className="flex gap-2">
                    {(['grid', 'lines'] as CardBackLayout[]).map(opt => (
                      <button key={opt} type="button" onClick={() => setV('card_back_layout', opt)}
                        className={`flex-1 text-xs font-semibold px-3 py-2 rounded-lg border transition-all ${
                          (verso.card_back_layout ?? 'grid') === opt
                            ? 'border-[var(--accent)] text-[var(--accent)]'
                            : 'border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--muted)]'
                        }`}>
                        {opt === 'grid' ? 'Grade' : 'Linhas'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-xs text-[var(--ink-soft)] cursor-pointer py-2">
                    <input type="checkbox" checked={verso.use_image_backdrop === true}
                      onChange={e => setV('use_image_backdrop', e.target.checked)} className="accent-[var(--accent)]" />
                    Imagem de fundo desfocada
                  </label>
                </div>
              </div>

              {/* Cores avançadas (colapsável) */}
              <div className="border-t border-[var(--line)] pt-3">
                <button type="button" onClick={() => setShowAdvanced(v => !v)}
                  className="text-xs font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] flex items-center gap-1">
                  {showAdvanced ? '▾' : '▸'} Cores avançadas
                </button>
                {showAdvanced && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <ColorField label="Fim do gradiente" value={verso.gradient_end_color} placeholder="#2563EB" onChange={v => setStr('gradient_end_color', v)} />
                    <ColorField label="Cor do título" value={verso.title_color} placeholder="#ffffff" onChange={v => setStr('title_color', v)} />
                    <ColorField label="Cor do one-liner" value={verso.one_liner_color} placeholder="#ffffff" onChange={v => setStr('one_liner_color', v)} />
                    <ColorField label="Cor da descrição" value={verso.description_color} placeholder="#6B7280" onChange={v => setStr('description_color', v)} />
                    <ColorField label="Fundo dos mini-cards" value={verso.mini_card_bg_color} placeholder="#ffffff" onChange={v => setStr('mini_card_bg_color', v)} />
                    <ColorField label="Rótulo dos mini-cards" value={verso.mini_card_label_color} placeholder="#6B7280" onChange={v => setStr('mini_card_label_color', v)} />
                    <ColorField label="Valor dos mini-cards" value={verso.mini_card_value_color} placeholder="#111827" onChange={v => setStr('mini_card_value_color', v)} />
                    <ColorField label="Cor das estrelas" value={verso.star_color} placeholder={verso.campaign_color || '#2563EB'} onChange={v => setStr('star_color', v)} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: live preview */}
      <div className="w-56 shrink-0 sticky top-6">
        <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide mb-3">Verso — preview</p>
        <CardBackPreview verso={verso} imageUrl={thumbUrl || null} title={campaign.campaign_title || campaign.name} />
      </div>
    </div>
  )
}
