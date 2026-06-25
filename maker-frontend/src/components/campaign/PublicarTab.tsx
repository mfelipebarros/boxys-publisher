import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type {
  LocalCampaign, LocalCreative, LocalCarousel, Destination, DestinationOption,
  BoxyAdvertisement, BocySocialCreative, BoxyLandingPage,
} from '../../types'

interface Props {
  campaignId: string
  campaign: LocalCampaign
  banners: LocalCreative[]
  videos: LocalCreative[]
  carousels: LocalCarousel[]
  boxysCampaignId?: number | null
  advertisements?: BoxyAdvertisement[]
  social_creatives?: BocySocialCreative[]
  landing_pages?: BoxyLandingPage[]
}

type ItemType = 'banner' | 'video' | 'carousel'

interface ItemRow {
  id: number
  name: string
  type: ItemType
  destination: Destination
}

function parseDestination(raw?: string | null): Destination {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as DestinationOption[]
  } catch { /* ignore */ }
  // backward compat: old single-value strings
  if (raw === 'social' || raw === 'ad') return [raw]
  return null
}

function serializeDestination(d: Destination): string | null {
  if (!d || d.length === 0) return null
  return JSON.stringify(d)
}

function DestinationPicker({
  value,
  onChange,
}: {
  value: Destination
  onChange: (v: Destination) => void
}) {
  function toggle(opt: DestinationOption) {
    const current = value ?? []
    const next = current.includes(opt)
      ? current.filter(x => x !== opt)
      : [...current, opt]
    onChange(next.length === 0 ? null : next)
  }

  const hasSocial = value?.includes('social') ?? false
  const hasAd = value?.includes('ad') ?? false

  return (
    <div className="flex gap-1">
      <button
        onClick={() => toggle('social')}
        className={`text-xs px-2 py-1 rounded-lg border transition-all ${
          hasSocial
            ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)] font-semibold'
            : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--muted)]'
        }`}
      >
        Rede Social
      </button>
      <button
        onClick={() => toggle('ad')}
        className={`text-xs px-2 py-1 rounded-lg border transition-all ${
          hasAd
            ? 'border-orange-500 bg-orange-500/10 text-orange-500 font-semibold'
            : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--muted)]'
        }`}
      >
        Anúncio
      </button>
    </div>
  )
}

function TypeBadge({ type }: { type: ItemType }) {
  const map: Record<ItemType, { label: string; color: string }> = {
    banner: { label: 'Banner', color: 'bg-blue-500/10 text-blue-400' },
    video: { label: 'Vídeo', color: 'bg-purple-500/10 text-purple-400' },
    carousel: { label: 'Carrossel', color: 'bg-green-500/10 text-green-400' },
  }
  const { label, color } = map[type]
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${color}`}>{label}</span>
}

function StatusBadge({ published }: { published: boolean }) {
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
      published ? 'bg-green-900/50 text-green-400' : 'bg-[var(--surface-raised)] text-[var(--muted)]'
    }`}>
      {published ? 'Publicado' : 'Rascunho'}
    </span>
  )
}

export function PublicarTab({
  campaignId,
  banners,
  videos,
  carousels,
  boxysCampaignId,
  advertisements = [],
  social_creatives = [],
  landing_pages = [],
}: Props) {
  const qc = useQueryClient()

  const [destinations, setDestinations] = useState<Record<string, Destination>>(() => {
    const d: Record<string, Destination> = {}
    banners.forEach(b => { d[`banner-${b.id}`] = parseDestination(b.destination as unknown as string) })
    videos.forEach(v => { d[`video-${v.id}`] = parseDestination(v.destination as unknown as string) })
    carousels.forEach(c => { d[`carousel-${c.id}`] = parseDestination(c.destination as unknown as string) })
    return d
  })

  const rows: ItemRow[] = [
    ...banners.map(b => ({ id: b.id, name: b.name, type: 'banner' as ItemType, destination: destinations[`banner-${b.id}`] ?? null })),
    ...videos.map(v => ({ id: v.id, name: v.name, type: 'video' as ItemType, destination: destinations[`video-${v.id}`] ?? null })),
    ...carousels.map(c => ({ id: c.id, name: c.name, type: 'carousel' as ItemType, destination: destinations[`carousel-${c.id}`] ?? null })),
  ]

  const totalItems = rows.length
  const undefinedCount = rows.filter(r => !r.destination || r.destination.length === 0).length
  const canPublish = totalItems > 0 && undefinedCount === 0 && !!boxysCampaignId

  function saveDestination(row: ItemRow, value: Destination) {
    const serialized = serializeDestination(value)
    if (row.type === 'carousel') {
      api.put(`/api/carousels/${row.id}`, { destination: serialized })
        .then(() => qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] }))
    } else {
      api.put(`/api/creatives/${row.id}`, { destination: serialized })
        .then(() => qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] }))
    }
  }

  function setDestination(row: ItemRow, value: Destination) {
    const key = `${row.type}-${row.id}`
    setDestinations(prev => ({ ...prev, [key]: value }))
    saveDestination(row, value)
  }

  function setAllDestination(opt: DestinationOption) {
    const next: Record<string, Destination> = {}
    rows.forEach(r => {
      const key = `${r.type}-${r.id}`
      const current = destinations[key] ?? []
      next[key] = current.includes(opt) ? current : [...current, opt]
    })
    setDestinations(prev => ({ ...prev, ...next }))
    rows.forEach(r => saveDestination(r, next[`${r.type}-${r.id}`]))
  }

  function setAllBoth() {
    const both: DestinationOption[] = ['social', 'ad']
    const next: Record<string, Destination> = {}
    rows.forEach(r => { next[`${r.type}-${r.id}`] = both })
    setDestinations(prev => ({ ...prev, ...next }))
    rows.forEach(r => saveDestination(r, both))
  }

  const totalPublished = advertisements.length + social_creatives.length + landing_pages.length

  return (
    <div className="max-w-3xl space-y-8">
      {/* Published items (from Boxys) */}
      {totalPublished > 0 && (
        <div>
          <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide mb-3">
            Publicado no Boxys ({totalPublished})
          </h3>
          <div className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--line)] overflow-hidden">
            {advertisements.map((ad, i) => (
              <div key={ad.id} className={`flex items-center gap-3 px-4 py-3 ${i < totalPublished - 1 ? 'border-b border-[var(--line)]' : ''}`}>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 shrink-0">Anúncio</span>
                <span className="flex-1 text-sm text-[var(--ink)] truncate">{ad.title || 'Sem título'}</span>
                <span className="text-xs text-[var(--muted)]">{ad.format}{ad.dimensions ? ` · ${ad.dimensions}` : ''}</span>
                <StatusBadge published={ad.published} />
              </div>
            ))}
            {social_creatives.map((sc, i) => (
              <div key={sc.id} className={`flex items-center gap-3 px-4 py-3 ${advertisements.length + i < totalPublished - 1 ? 'border-b border-[var(--line)]' : ''}`}>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 shrink-0">Social</span>
                <span className="flex-1 text-sm text-[var(--ink)] truncate">{sc.title || 'Sem título'}</span>
                <span className="text-xs text-[var(--muted)]">{sc.format}</span>
                <StatusBadge published={sc.published} />
              </div>
            ))}
            {landing_pages.map((lp, i) => (
              <div key={lp.id} className={`flex items-center gap-3 px-4 py-3 ${advertisements.length + social_creatives.length + i < totalPublished - 1 ? 'border-b border-[var(--line)]' : ''}`}>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 shrink-0">Landing Page</span>
                <span className="flex-1 text-sm text-[var(--ink)] truncate">{lp.slug}</span>
                <StatusBadge published={lp.published} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Items to publish (local) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">
            Prontos para publicar ({totalItems})
          </h3>
          {totalItems > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => setAllDestination('social')}
                className="text-xs px-2 py-1 rounded border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              >
                + Social a todos
              </button>
              <button
                onClick={() => setAllDestination('ad')}
                className="text-xs px-2 py-1 rounded border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              >
                + Anúncio a todos
              </button>
              <button
                onClick={setAllBoth}
                className="text-xs px-2 py-1 rounded border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              >
                Ambos a todos
              </button>
            </div>
          )}
        </div>

        {totalItems === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--line)]">
            <p className="font-semibold text-sm text-[var(--ink-soft)]">Nenhum item local para publicar</p>
            <p className="text-xs text-[var(--muted)] mt-1">
              Adicione banners, vídeos ou carrosseis nas abas correspondentes.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--line)] overflow-hidden mb-4">
              {rows.map((row, i) => (
                <div
                  key={`${row.type}-${row.id}`}
                  className={`flex items-center gap-3 px-4 py-3 ${i < rows.length - 1 ? 'border-b border-[var(--line)]' : ''}`}
                >
                  <TypeBadge type={row.type} />
                  <span className="flex-1 text-sm text-[var(--ink)] truncate">{row.name}</span>
                  {(!row.destination || row.destination.length === 0) && (
                    <span className="text-[10px] text-yellow-500 font-mono mr-1 shrink-0">⚠ sem destino</span>
                  )}
                  <DestinationPicker
                    value={row.destination}
                    onChange={v => setDestination(row, v)}
                  />
                </div>
              ))}
            </div>

            <div className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--line)] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">
                    {canPublish
                      ? `${totalItems} item${totalItems !== 1 ? 's' : ''} prontos`
                      : undefinedCount > 0
                        ? `${undefinedCount} item${undefinedCount !== 1 ? 's' : ''} sem destino`
                        : 'Vincule a uma campanha Boxys primeiro'
                    }
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    {canPublish
                      ? 'Todos com destino definido. Pronto para publicar.'
                      : 'Selecione pelo menos um destino para cada item.'
                    }
                  </p>
                </div>
                <button
                  disabled={!canPublish}
                  className="text-sm font-semibold px-5 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  Publicar no Boxys →
                </button>
              </div>

              {!canPublish && undefinedCount > 0 && (
                <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    Selecione Rede Social, Anúncio, ou ambos para cada item antes de publicar.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
