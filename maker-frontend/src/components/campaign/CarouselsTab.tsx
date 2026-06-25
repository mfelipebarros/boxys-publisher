import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import { Modal, ModalFooter } from '../ui/Modal'
import { Input } from '../ui/Input'
import type { LocalCarousel, LocalCreative } from '../../types'

interface Props {
  campaignId: string
  carousels: LocalCarousel[]
  creatives: LocalCreative[]
}

function AddSlideModal({
  carouselId,
  campaignId,
  creatives,
  onClose,
}: {
  carouselId: number
  campaignId: string
  creatives: LocalCreative[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<number | null>(null)

  const addMut = useMutation({
    mutationFn: () => api.post(`/api/carousels/${carouselId}/items`, { creative_id: selected }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] })
      onClose()
    },
  })

  return (
    <Modal
      title="Adicionar slide"
      onClose={onClose}
      size="lg"
      footer={
        <ModalFooter
          onClose={onClose}
          onConfirm={() => selected && addMut.mutate()}
          confirmLabel="Adicionar"
          loading={addMut.isPending}
        />
      }
    >
      <div className="grid grid-cols-3 gap-3">
        {creatives.map(c => (
          <div
            key={c.id}
            onClick={() => setSelected(c.id)}
            className={`cursor-pointer rounded-[var(--radius)] border overflow-hidden transition-all ${
              selected === c.id ? 'border-[var(--accent)]' : 'border-[var(--line)] hover:border-[var(--muted)]'
            }`}
          >
            <div className="aspect-video bg-[var(--surface-raised)] flex items-center justify-center overflow-hidden">
              {c.thumbnail_url
                ? <img src={c.thumbnail_url} alt="" className="w-full h-full object-cover" />
                : <span className="text-xs font-mono text-[var(--muted)]">{c.width}×{c.height}</span>
              }
            </div>
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium truncate text-[var(--ink-soft)]">{c.name}</p>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

function CarouselBlock({
  carousel,
  campaignId,
  creatives,
}: {
  carousel: LocalCarousel
  campaignId: string
  creatives: LocalCreative[]
}) {
  const qc = useQueryClient()
  const [showAddSlide, setShowAddSlide] = useState(false)
  const [open, setOpen] = useState(true)

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/api/carousels/${carousel.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] }),
  })

  const removeItemMut = useMutation({
    mutationFn: (itemId: number) => api.delete(`/api/carousel-items/${itemId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] }),
  })

  async function moveItem(itemId: number, direction: 'up' | 'down') {
    const items = [...carousel.items].sort((a, b) => a.position - b.position)
    const idx = items.findIndex(i => i.id === itemId)
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === items.length - 1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const newOrder = items.map(i => i.id)
    ;[newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]]
    await api.put(`/api/carousels/${carousel.id}/order`, { item_ids: newOrder })
    qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] })
  }

  const sortedItems = [...carousel.items].sort((a, b) => a.position - b.position)

  return (
    <div className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--line)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--line)]">
        <button onClick={() => setOpen(!open)} className="text-[var(--muted)] text-xs">
          {open ? '▼' : '▶'}
        </button>
        <span className="font-semibold text-sm text-[var(--ink)] flex-1">{carousel.name}</span>
        <span className="text-xs text-[var(--muted)]">{sortedItems.length} slides</span>
        <Button size="sm" variant="secondary" onClick={() => setShowAddSlide(true)}>+ Slide</Button>
        <Button size="sm" variant="danger" onClick={() => confirm(`Deletar "${carousel.name}"?`) && deleteMut.mutate()}>
          ×
        </Button>
      </div>

      {/* Slides */}
      {open && (
        <div className="p-4">
          {sortedItems.length === 0 ? (
            <p className="text-xs text-[var(--muted)] text-center py-4">Nenhum slide. Adicione criativos ao carrossel.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {sortedItems.map((item, idx) => {
                const creative = creatives.find(c => c.id === item.creative_id)
                return (
                  <div key={item.id} className="flex items-center gap-3 bg-[var(--surface-raised)] rounded-lg px-3 py-2">
                    <span className="text-xs font-mono text-[var(--muted)] w-5">{idx + 1}</span>
                    {creative?.thumbnail_url ? (
                      <img src={creative.thumbnail_url} alt="" className="w-12 h-8 object-cover rounded" />
                    ) : (
                      <div className="w-12 h-8 bg-[var(--surface)] rounded flex items-center justify-center">
                        <span className="text-[9px] text-[var(--muted)]">{creative?.width}×{creative?.height}</span>
                      </div>
                    )}
                    <span className="flex-1 text-xs text-[var(--ink-soft)] truncate">
                      {creative?.name ?? item.creative_name ?? `Criativo ${item.creative_id}`}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => moveItem(item.id, 'up')} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] px-1" disabled={idx === 0}>↑</button>
                      <button onClick={() => moveItem(item.id, 'down')} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] px-1" disabled={idx === sortedItems.length - 1}>↓</button>
                      <button onClick={() => removeItemMut.mutate(item.id)} className="text-xs text-[var(--red)] hover:opacity-70 px-1">×</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {showAddSlide && (
        <AddSlideModal
          carouselId={carousel.id}
          campaignId={campaignId}
          creatives={creatives}
          onClose={() => setShowAddSlide(false)}
        />
      )}
    </div>
  )
}

export function CarouselsTab({ campaignId, carousels, creatives }: Props) {
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
          <p className="text-xs text-[var(--muted)] mt-1">Crie um carrossel e adicione slides.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {carousels.map(c => (
            <CarouselBlock
              key={c.id}
              carousel={c}
              campaignId={campaignId}
              creatives={creatives}
            />
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
              placeholder="ex: Feed 1080x1080"
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
