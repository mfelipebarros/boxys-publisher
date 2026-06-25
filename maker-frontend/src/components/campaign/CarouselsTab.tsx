import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import { Modal, ModalFooter } from '../ui/Modal'
import { Input } from '../ui/Input'
import type { LocalCarousel, LocalCarouselAsset } from '../../types'

interface Props {
  campaignId: string
  carousels: LocalCarousel[]
}

function AssetRow({
  asset,
  campaignId,
  carouselId: _carouselId,
  idx,
  total,
  onMove,
}: {
  asset: LocalCarouselAsset
  campaignId: string
  carouselId: number
  idx: number
  total: number
  onMove: (assetId: number, dir: 'up' | 'down') => void
}) {
  const qc = useQueryClient()
  const [caption, setCaption] = useState(asset.caption ?? '')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const removeMut = useMutation({
    mutationFn: () => api.delete(`/api/carousel-assets/${asset.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] }),
  })

  const captionMut = useMutation({
    mutationFn: (val: string) => api.put(`/api/carousel-assets/${asset.id}`, { caption: val }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] }),
  })

  function handleCaptionChange(val: string) {
    setCaption(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => captionMut.mutate(val), 800)
  }

  return (
    <div className="flex items-center gap-3 bg-[var(--surface-raised)] rounded-lg px-3 py-2">
      <span className="text-xs font-mono text-[var(--muted)] w-5 shrink-0">{idx + 1}</span>

      {asset.thumbnail_url ? (
        <img src={asset.thumbnail_url} alt="" className="w-12 h-8 object-cover rounded shrink-0" />
      ) : (
        <div className="w-12 h-8 bg-[var(--surface)] rounded flex items-center justify-center shrink-0">
          <span className="text-[9px] font-mono text-[var(--muted)]">{asset.type.toUpperCase()}</span>
        </div>
      )}

      <input
        value={caption}
        onChange={e => handleCaptionChange(e.target.value)}
        placeholder="Legenda do slide…"
        className="flex-1 min-w-0 text-xs bg-transparent border-0 outline-none text-[var(--ink-soft)] placeholder:text-[var(--muted)]"
      />

      <span className="text-[10px] font-mono text-[var(--muted)] px-1.5 py-0.5 bg-[var(--surface)] rounded shrink-0">
        {asset.type.toUpperCase()}
      </span>

      <div className="flex gap-0.5 shrink-0">
        <button
          onClick={() => onMove(asset.id, 'up')}
          disabled={idx === 0}
          className="text-xs text-[var(--muted)] hover:text-[var(--ink)] px-1 disabled:opacity-30"
        >↑</button>
        <button
          onClick={() => onMove(asset.id, 'down')}
          disabled={idx === total - 1}
          className="text-xs text-[var(--muted)] hover:text-[var(--ink)] px-1 disabled:opacity-30"
        >↓</button>
        <button
          onClick={() => removeMut.mutate()}
          disabled={removeMut.isPending}
          className="text-xs text-[var(--red,#ef4444)] hover:opacity-70 px-1"
        >×</button>
      </div>
    </div>
  )
}

function CarouselBlock({
  carousel,
  campaignId,
}: {
  carousel: LocalCarousel
  campaignId: string
}) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/api/carousels/${carousel.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] }),
  })

  async function uploadAsset(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.upload(`/api/carousels/${carousel.id}/assets`, fd)
      qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] })
    } finally {
      setUploading(false)
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return
    Array.from(files).forEach(f => uploadAsset(f))
  }

  async function moveAsset(assetId: number, dir: 'up' | 'down') {
    const sorted = [...(carousel.assets ?? [])].sort((a, b) => a.position - b.position)
    const idx = sorted.findIndex(a => a.id === assetId)
    if (dir === 'up' && idx === 0) return
    if (dir === 'down' && idx === sorted.length - 1) return
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    const order = sorted.map(a => a.id)
    ;[order[idx], order[swapIdx]] = [order[swapIdx], order[idx]]
    await api.put(`/api/carousels/${carousel.id}/assets/order`, { ordered_asset_ids: order })
    qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] })
  }

  const sortedAssets = [...(carousel.assets ?? [])].sort((a, b) => a.position - b.position)

  return (
    <div className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--line)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--line)]">
        <button onClick={() => setOpen(!open)} className="text-[var(--muted)] text-xs w-4">
          {open ? '▼' : '▶'}
        </button>
        <span className="font-semibold text-sm text-[var(--ink)] flex-1">{carousel.name}</span>
        <span className="text-xs text-[var(--muted)]">{sortedAssets.length} slides</span>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? '…' : '+ Slide'}
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => confirm(`Deletar "${carousel.name}"?`) && deleteMut.mutate()}
        >×</Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.html,.htm"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {/* Assets */}
      {open && (
        <div className="p-4">
          {sortedAssets.length === 0 ? (
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-[var(--line)] rounded-lg p-6 text-center cursor-pointer hover:border-[var(--muted)] transition-colors"
            >
              <p className="text-xs text-[var(--muted)]">
                Clique em "+ Slide" ou aqui para adicionar imagens ou HTMLs ao carrossel
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {sortedAssets.map((asset, idx) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  campaignId={campaignId}
                  carouselId={carousel.id}
                  idx={idx}
                  total={sortedAssets.length}
                  onMove={moveAsset}
                />
              ))}
              <button
                onClick={() => fileRef.current?.click()}
                className="text-xs text-[var(--muted)] hover:text-[var(--ink)] py-2 border border-dashed border-[var(--line)] rounded-lg transition-colors"
              >
                + Adicionar slide
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function CarouselsTab({ campaignId, carousels }: Props) {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  async function createCarousel() {
    if (!name.trim()) return
    setCreating(true)
    try {
      await api.post(`/api/campaigns/${campaignId}/carousels`, { name: name.trim() })
      qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] })
      setShowCreate(false)
      setName('')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <Button onClick={() => setShowCreate(true)}>+ Novo carrossel</Button>
      </div>

      <div className="h-px bg-[var(--line)] mb-6" />

      {carousels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--line)]">
          <p className="font-semibold text-sm text-[var(--ink-soft)]">Nenhum carrossel ainda</p>
          <p className="text-xs text-[var(--muted)] mt-1">
            Crie um carrossel e adicione imagens ou HTMLs dentro dele.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {carousels.map(c => (
            <CarouselBlock key={c.id} carousel={c} campaignId={campaignId} />
          ))}
        </div>
      )}

      {showCreate && (
        <Modal
          title="Novo carrossel"
          onClose={() => setShowCreate(false)}
          size="sm"
          footer={
            <ModalFooter
              onClose={() => setShowCreate(false)}
              onConfirm={createCarousel}
              confirmLabel="Criar"
              loading={creating}
            />
          }
        >
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Nome</label>
            <Input
              placeholder="ex: Feed 1080x1080 — Lançamento"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createCarousel()}
              autoFocus
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
