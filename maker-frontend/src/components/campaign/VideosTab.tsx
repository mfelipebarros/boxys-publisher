import { useState, useRef } from 'react'
import type { DragEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import { PublishToBoxysModal } from './PublishToBoxysModal'
import type { LocalCreative, LocalCopy } from '../../types'

interface Props {
  campaignId: string
  creatives: LocalCreative[]
  copies: LocalCopy[]
  boxysCampaignId?: number | null
}

function VideoCard({
  creative,
  copies,
  campaignId,
  boxysCampaignId,
}: {
  creative: LocalCreative
  copies: LocalCopy[]
  campaignId: string
  boxysCampaignId?: number | null
}) {
  const qc = useQueryClient()
  const [showCopyPicker, setShowCopyPicker] = useState(false)
  const [showPublish, setShowPublish] = useState(false)
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

  const assignedCopy = copies.find(c => c.id === creative.copy_id)

  return (
    <div className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--line)] overflow-hidden group relative">
      <div className="aspect-video bg-[var(--surface-raised)] flex items-center justify-center overflow-hidden relative">
        {creative.thumbnail_url ? (
          <img src={creative.thumbnail_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-3xl">🎬</span>
        )}
        <span className="absolute top-1.5 left-1.5 text-[10px] font-mono font-bold bg-black/60 text-white px-1.5 py-0.5 rounded">
          VIDEO
        </span>
      </div>

      <div className="px-3 py-2.5">
        <p className="font-semibold text-sm truncate text-[var(--ink)]">{creative.name}</p>
        <p className="text-xs text-[var(--muted)] mt-0.5">Vídeo</p>

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
              {copies.filter(c => c.type === 'criativo').map(c => (
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

      <div className="px-3 pb-2.5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="sm" variant="secondary" onClick={() => setShowPublish(true)}>↑ Publicar</Button>
        <Button size="sm" variant="danger" onClick={handleDelete} disabled={deleting}>
          {deleting ? '…' : '×'}
        </Button>
      </div>

      {showCopyPicker && (
        <div className="fixed inset-0 z-10" onClick={() => setShowCopyPicker(false)} />
      )}

      {showPublish && (
        <PublishToBoxysModal
          creativeId={creative.id}
          creativeName={creative.name}
          copies={copies}
          defaultCopyId={creative.copy_id}
          defaultCampaignId={boxysCampaignId}
          onClose={() => setShowPublish(false)}
        />
      )}
    </div>
  )
}

export function VideosTab({ campaignId, creatives, copies, boxysCampaignId }: Props) {
  const qc = useQueryClient()
  const [dragging, setDragging] = useState(false)
  const videoRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function uploadVideo(file: File) {
    if (!file.type.startsWith('video/')) return
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

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('video/')) uploadVideo(file)
  }

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <Button onClick={() => videoRef.current?.click()}>
          {uploading ? 'Enviando…' : '+ Upload vídeo'}
        </Button>
        <input
          ref={videoRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={e => e.target.files?.[0] && uploadVideo(e.target.files[0])}
        />
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mb-8 border-2 border-dashed rounded-[var(--radius)] p-4 text-center text-xs transition-all ${
          dragging
            ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]'
            : 'border-[var(--line)] text-[var(--muted)]'
        }`}
      >
        {uploading ? 'Enviando…' : 'Solte um vídeo aqui para fazer upload'}
      </div>

      {creatives.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--line)]">
          <p className="font-semibold text-sm text-[var(--ink-soft)]">Nenhum vídeo ainda</p>
          <p className="text-xs text-[var(--muted)] mt-1">Faça upload de arquivos de vídeo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {creatives.map(c => (
            <VideoCard key={c.id} creative={c} copies={copies} campaignId={campaignId} boxysCampaignId={boxysCampaignId} />
          ))}
        </div>
      )}
    </div>
  )
}
