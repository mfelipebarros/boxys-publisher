import { useState, useRef } from 'react'
import type { DragEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Modal, ModalFooter } from '../ui/Modal'
import { Input } from '../ui/Input'

interface Props {
  campaignId: string
  onClose: () => void
}

interface ParsedMeta {
  title: string
  desc: string
  message: string
  format_label: string
  width: number
  height: number
}

interface ImageInfo {
  url: string
  in_supabase: boolean
}

interface ParseResponse {
  status: string
  meta: ParsedMeta
  filename: string
  images: ImageInfo[]
}

export function ImportHtmlModal({ campaignId, onClose }: Props) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParseResponse | null>(null)
  const [meta, setMeta] = useState<ParsedMeta | null>(null)
  const [error, setError] = useState('')

  const parseMut = useMutation({
    mutationFn: async (f: File) => {
      const fd = new FormData()
      fd.append('file', f)
      return api.upload<ParseResponse>(`/api/campaigns/${campaignId}/parse-html`, fd)
    },
    onSuccess: (data) => {
      setParsed(data)
      setMeta({ ...data.meta })
    },
    onError: (e: Error) => setError(e.message),
  })

  const importMut = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('file', file!)
      fd.append('title', meta!.title)
      fd.append('desc', meta!.desc)
      fd.append('message', meta!.message)
      fd.append('upload', 'true')
      return api.upload(`/api/campaigns/${campaignId}/import-html`, fd)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  function handleFile(f: File) {
    setError('')
    setParsed(null)
    setMeta(null)
    setFile(f)
    parseMut.mutate(f)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const adSize = meta
    ? meta.format_label || (meta.width && meta.height ? `${meta.width}×${meta.height}` : '')
    : ''

  if (parsed && meta) {
    const total = parsed.images.length
    const inSupabase = parsed.images.filter(i => i.in_supabase).length
    const toUpload = total - inSupabase

    return (
      <Modal
        title="Confirmar import"
        onClose={onClose}
        footer={
          <ModalFooter
            onClose={onClose}
            onConfirm={() => importMut.mutate()}
            confirmLabel={toUpload > 0 ? `↑ Importar e subir ${toUpload} imagem${toUpload !== 1 ? 'ns' : ''}` : 'Importar'}
            loading={importMut.isPending}
          />
        }
      >
        <div className="flex flex-col gap-4">
          {/* Arquivo + tamanho */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-[var(--muted)]">{parsed.filename}</span>
            {adSize && (
              <span className="text-xs font-semibold text-[var(--accent)] bg-[var(--accent-bg)] px-2 py-0.5 rounded">
                {adSize}
              </span>
            )}
          </div>

          {/* Image checker */}
          {total === 0 ? (
            <p className="text-xs text-[var(--muted)] bg-[var(--surface-raised)] rounded-lg px-3 py-2">
              Nenhuma imagem encontrada no HTML.
            </p>
          ) : (
            <div className="text-xs bg-[var(--surface-raised)] rounded-lg px-3 py-2 flex items-center gap-1.5">
              <span className="text-[var(--muted)]">
                {total} imagem{total !== 1 ? 'ns' : ''} encontrada{total !== 1 ? 's' : ''} —
              </span>
              <span className="text-green-400">{inSupabase} já no Supabase</span>
              {toUpload > 0 && (
                <>
                  <span className="text-[var(--muted)]">,</span>
                  <span className="font-semibold text-[var(--amber)]">{toUpload} será{toUpload !== 1 ? 'ão' : ''} importada{toUpload !== 1 ? 's' : ''}</span>
                </>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Título</label>
            <Input value={meta.title} onChange={e => setMeta({ ...meta, title: e.target.value })} placeholder="Título do anúncio" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Descrição</label>
            <Input value={meta.desc} onChange={e => setMeta({ ...meta, desc: e.target.value })} placeholder="Descrição" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Mensagem / CTA</label>
            <Input value={meta.message} onChange={e => setMeta({ ...meta, message: e.target.value })} placeholder="Mensagem ou CTA" />
          </div>
        </div>
        {error && <p className="text-xs text-[var(--red)] mt-3">{error}</p>}
      </Modal>
    )
  }

  return (
    <Modal title="Importar HTML" onClose={onClose}>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-[var(--radius)] p-12 text-center cursor-pointer transition-all ${
          dragging
            ? 'border-[var(--accent)] bg-[var(--accent-bg)]'
            : 'border-[var(--line)] hover:border-[var(--muted)]'
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".html,.zip"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {parseMut.isPending ? (
          <p className="text-sm text-[var(--muted)]">Analisando arquivo…</p>
        ) : (
          <>
            <p className="text-sm font-semibold text-[var(--ink-soft)]">Solte o arquivo aqui</p>
            <p className="text-xs text-[var(--muted)] mt-2">ou clique para selecionar (.html ou .zip)</p>
          </>
        )}
      </div>
      {error && <p className="text-xs text-[var(--red)] mt-3">{error}</p>}
    </Modal>
  )
}
