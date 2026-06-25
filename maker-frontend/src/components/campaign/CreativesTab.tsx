import { useState, useRef } from 'react'
import type { DragEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import { ImportHtmlModal } from './ImportHtmlModal'
import type { LocalCreative, LocalCopy } from '../../types'

interface Props {
  campaignId: string
  creatives: LocalCreative[]
  copies: LocalCopy[]
}

function CreativeCard({
  creative,
  copies,
  campaignId,
}: {
  creative: LocalCreative
  copies: LocalCopy[]
  campaignId: string
}) {
  const qc = useQueryClient()
  const [showCopyPicker, setShowCopyPicker] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const assignMut = useMutation({
    mutationFn: (copyId: number | null) =>
      api.put(`/api/creatives/${creative.id}/copy`, { copy_id: copyId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] })
      setShowCopyPicker(false)
    },
  })

  async function handleDelete() {
    if (!confirm(`Deletar "${creative.name}"?`)) return
    setDeleting(true)
    try {
      await api.delete(`/api/creatives/${creative.id}`)
      qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] })
    } finally {
      setDeleting(false)
    }
  }

  async function handleDownload() {
    const a = document.createElement('a')
    a.href = `/api/creatives/${creative.id}/download`
    a.download = creative.name
    a.click()
  }

  const assignedCopy = copies.find(c => c.id === creative.copy_id)

  return (
    <div className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--line)] overflow-hidden group relative">
      {/* Thumbnail */}
      <div className="aspect-video bg-[var(--surface-raised)] flex items-center justify-center overflow-hidden">
        {creative.thumbnail_url
          ? <img src={creative.thumbnail_url} alt="" className="w-full h-full object-cover" />
          : (
            <span className="text-xs font-mono text-[var(--muted)]">
              {creative.width}×{creative.height}
            </span>
          )
        }
      </div>

      {/* Info */}
      <div className="px-3 py-2.5">
        <p className="font-semibold text-sm truncate text-[var(--ink)]">{creative.name}</p>
        <p className="text-xs text-[var(--muted)] mt-0.5">{creative.format_label || `${creative.width}×${creative.height}`}</p>

        {/* Copy badge */}
        <div className="mt-2 relative">
          <button
            onClick={() => setShowCopyPicker(!showCopyPicker)}
            className={`text-xs px-2 py-0.5 rounded-full border transition-all ${
              assignedCopy
                ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-bg)]'
                : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--muted)]'
            }`}
          >
            {assignedCopy ? assignedCopy.name : '+ copy'}
          </button>

          {showCopyPicker && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-[var(--surface-raised)] border border-[var(--line)] rounded-lg shadow-lg min-w-[160px] py-1">
              <button
                onClick={() => assignMut.mutate(null)}
                className="w-full text-left text-xs px-3 py-1.5 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
              >
                Sem copy
              </button>
              {copies.map(c => (
                <button
                  key={c.id}
                  onClick={() => assignMut.mutate(c.id)}
                  className={`w-full text-left text-xs px-3 py-1.5 hover:bg-[var(--surface)] transition-colors ${
                    c.id === creative.copy_id ? 'text-[var(--accent)]' : 'text-[var(--ink-soft)]'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-3 pb-2.5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="sm" variant="secondary" onClick={handleDownload}>↓</Button>
        <Button size="sm" variant="danger" onClick={handleDelete} disabled={deleting}>
          {deleting ? '…' : '×'}
        </Button>
      </div>

      {/* Click outside to close picker */}
      {showCopyPicker && (
        <div className="fixed inset-0 z-10" onClick={() => setShowCopyPicker(false)} />
      )}
    </div>
  )
}

export function CreativesTab({ campaignId, creatives, copies }: Props) {
  const qc = useQueryClient()
  const [showImport, setShowImport] = useState(false)
  const [draggingMedia, setDraggingMedia] = useState(false)
  const mediaRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function uploadMedia(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.upload(`/api/campaigns/${campaignId}/upload`, fd)
      qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] })
    } finally {
      setUploading(false)
    }
  }

  function onMediaDrop(e: DragEvent) {
    e.preventDefault()
    setDraggingMedia(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadMedia(file)
  }

  return (
    <div>
      {/* Actions */}
      <div className="flex gap-2 mb-6">
        <Button onClick={() => setShowImport(true)}>+ Importar HTML</Button>
        <Button variant="secondary" onClick={() => mediaRef.current?.click()}>
          {uploading ? 'Enviando…' : '+ Upload mídia'}
        </Button>
        <input
          ref={mediaRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={e => e.target.files?.[0] && uploadMedia(e.target.files[0])}
        />
      </div>

      {/* Media drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDraggingMedia(true) }}
        onDragLeave={() => setDraggingMedia(false)}
        onDrop={onMediaDrop}
        className={`mb-8 border-2 border-dashed rounded-[var(--radius)] p-4 text-center text-xs transition-all ${
          draggingMedia
            ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]'
            : 'border-[var(--line)] text-[var(--muted)]'
        }`}
      >
        {uploading ? 'Enviando…' : 'Solte imagem ou vídeo aqui para fazer upload'}
      </div>

      {creatives.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--line)]">
          <p className="font-semibold text-sm text-[var(--ink-soft)]">Nenhum criativo ainda</p>
          <p className="text-xs text-[var(--muted)] mt-1">Importe um HTML ou faça upload de uma mídia.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {creatives.map(c => (
            <CreativeCard key={c.id} creative={c} copies={copies} campaignId={campaignId} />
          ))}
        </div>
      )}

      {showImport && (
        <ImportHtmlModal campaignId={campaignId} onClose={() => setShowImport(false)} />
      )}
    </div>
  )
}
