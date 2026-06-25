import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import type { LocalCreative, LocalCopy } from '../../types'

interface Props {
  campaignId: string
  creatives: LocalCreative[]
  copies: LocalCopy[]
}

function LPCard({
  creative,
  campaignId,
}: {
  creative: LocalCreative
  campaignId: string
}) {
  const qc = useQueryClient()

  async function handleDelete() {
    if (!confirm(`Deletar "${creative.name}"?`)) return
    await api.delete(`/api/creatives/${creative.id}`)
    qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] })
  }

  async function handleDownload() {
    const a = document.createElement('a')
    a.href = `/api/creatives/${creative.id}/download`
    a.download = `${creative.name}.html`
    a.click()
  }

  return (
    <div className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--line)] overflow-hidden">
      <div className="aspect-video bg-[var(--surface-raised)] flex items-center justify-center overflow-hidden">
        {creative.thumbnail_url ? (
          <img src={creative.thumbnail_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-3xl">🌐</span>
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="font-semibold text-sm truncate text-[var(--ink)]">{creative.name}</p>
        <p className="text-xs text-[var(--muted)] mt-0.5">Landing Page HTML</p>
        <div className="flex gap-2 mt-3">
          <Button size="sm" variant="secondary" onClick={handleDownload}>↓ Download</Button>
          <Button size="sm" variant="danger" onClick={handleDelete}>Deletar</Button>
        </div>
      </div>
    </div>
  )
}

export function LandingPageTab({ campaignId, creatives }: Props) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('creative_type', 'landing_page')
      return api.upload(`/api/campaigns/${campaignId}/import-html`, fd)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] }),
  })

  function handleFiles(files: FileList | null) {
    if (!files) return
    Array.from(files)
      .filter(f => f.name.endsWith('.html') || f.name.endsWith('.htm'))
      .forEach(f => uploadMut.mutate(f))
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button onClick={() => inputRef.current?.click()} disabled={uploadMut.isPending}>
          {uploadMut.isPending ? 'Importando…' : '+ Importar HTML'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".html,.htm"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        <p className="text-xs text-[var(--muted)]">Importa arquivos .html como landing pages da campanha</p>
      </div>

      <div className="h-px bg-[var(--line)] mb-6" />

      {creatives.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--line)] border-dashed">
          <p className="text-2xl mb-2">🌐</p>
          <p className="font-semibold text-sm text-[var(--ink-soft)]">Nenhuma landing page ainda</p>
          <p className="text-xs text-[var(--muted)] mt-1">Importe um arquivo HTML para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {creatives.map(c => (
            <LPCard key={c.id} creative={c} campaignId={campaignId} />
          ))}
        </div>
      )}
    </div>
  )
}
