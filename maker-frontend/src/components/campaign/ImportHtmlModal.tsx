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

interface ParseResponse {
  status: string
  meta: ParsedMeta
  filename: string
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
    return (
      <Modal
        title="Confirmar import"
        onClose={onClose}
        footer={
          <ModalFooter
            onClose={onClose}
            onConfirm={() => importMut.mutate()}
            confirmLabel="Importar"
            loading={importMut.isPending}
          />
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-[var(--muted)]">
            Arquivo: <span className="font-mono text-[var(--ink-soft)]">{parsed.filename}</span>
            {adSize && <span className="ml-2 text-[var(--accent)]">{adSize}</span>}
          </p>

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
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Formato / Tamanho</label>
            <Input
              value={meta.format_label || (meta.width ? `${meta.width}×${meta.height}` : '')}
              disabled
              className="opacity-60"
            />
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
