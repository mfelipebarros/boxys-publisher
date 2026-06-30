import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Modal, ModalFooter } from '../ui/Modal'
import { Textarea, Input, Select } from '../ui/Input'

interface Props {
  campaignId: string
  onClose: () => void
}

type CopyType = 'criativo' | 'search' | 'display' | 'pmax' | 'landing_page' | 'asset'

interface ExtractedCopy {
  name: string
  type: CopyType
  title: string
  description: string
  message: string
  content: string
  content_html: string
}

interface ExtractResult {
  status: string
  copies: ExtractedCopy[]
  error?: string
}

interface BulkResult {
  status: string
  created: number
}

const TYPE_OPTIONS: CopyType[] = ['criativo', 'search', 'display', 'pmax', 'landing_page', 'asset']

export function ImportCopiesModal({ campaignId, onClose }: Props) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [rows, setRows] = useState<ExtractedCopy[] | null>(null)
  const [saved, setSaved] = useState<number | null>(null)
  const [error, setError] = useState('')

  const extractMut = useMutation({
    mutationFn: () =>
      api.post<ExtractResult>(`/api/campaigns/${campaignId}/copies/extract`, { text }),
    onSuccess: (data) => {
      if (!data.copies?.length) { setError('A IA não encontrou nenhuma copy no texto.'); return }
      setRows(data.copies)
    },
    onError: (e: Error) => setError(e.message),
  })

  const saveMut = useMutation({
    mutationFn: () =>
      api.post<BulkResult>(`/api/campaigns/${campaignId}/copies/bulk`, { copies: rows }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] })
      setSaved(data.created)
    },
    onError: (e: Error) => setError(e.message),
  })

  function updateRow(i: number, patch: Partial<ExtractedCopy>) {
    setRows(rs => rs ? rs.map((r, idx) => idx === i ? { ...r, ...patch } : r) : rs)
  }
  function removeRow(i: number) {
    setRows(rs => rs ? rs.filter((_, idx) => idx !== i) : rs)
  }

  // --- Resultado final ---
  if (saved !== null) {
    return (
      <Modal
        title="Copies importadas"
        onClose={onClose}
        footer={<button onClick={onClose} className="text-sm text-[var(--accent)] hover:underline">Fechar</button>}
      >
        <p className="text-sm text-[var(--ink-soft)]">
          <span className="font-semibold text-[var(--ink)]">{saved}</span> cop{saved !== 1 ? 'ies' : 'y'} criada{saved !== 1 ? 's' : ''}.
        </p>
      </Modal>
    )
  }

  // --- Passo 2: revisão ---
  if (rows) {
    return (
      <Modal
        title={`Revisar copies (${rows.length})`}
        onClose={onClose}
        size="xl"
        footer={
          <ModalFooter
            onClose={() => { setRows(null); setError('') }}
            onConfirm={() => { setError(''); saveMut.mutate() }}
            confirmLabel={`Salvar ${rows.length}`}
            loading={saveMut.isPending}
          />
        }
      >
        <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
          <p className="text-xs text-[var(--muted)]">
            Revise e ajuste o que a IA extraiu. Edite qualquer campo ou remova linhas antes de salvar.
          </p>
          {rows.map((r, i) => (
            <div key={i} className="bg-[var(--surface-raised)] rounded-lg p-3 border border-[var(--line)] flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Input
                  value={r.name}
                  onChange={e => updateRow(i, { name: e.target.value })}
                  className="font-mono text-xs flex-1"
                  placeholder="ID (ex: INVB-M-E01)"
                />
                <Select
                  value={r.type}
                  onChange={e => updateRow(i, { type: e.target.value as CopyType })}
                  className="text-xs w-36"
                >
                  {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
                <button
                  onClick={() => removeRow(i)}
                  className="text-[var(--muted)] hover:text-[var(--red)] text-lg leading-none px-1"
                  title="Remover"
                >×</button>
              </div>
              <Input value={r.title} onChange={e => updateRow(i, { title: e.target.value })} className="text-xs" placeholder="Título / Headline" />
              <Textarea value={r.description} onChange={e => updateRow(i, { description: e.target.value })} rows={2} className="text-xs" placeholder="Descrição / Legenda" />
              <Input value={r.message} onChange={e => updateRow(i, { message: e.target.value })} className="text-xs" placeholder="Mensagem / CTA" />
              {r.content && (
                <Textarea value={r.content} onChange={e => updateRow(i, { content: e.target.value })} rows={2} className="text-xs" placeholder="Conteúdo (direcionamento, selo, logo...)" />
              )}
              {r.content_html && (
                <Textarea value={r.content_html} onChange={e => updateRow(i, { content_html: e.target.value })} rows={3} className="text-xs font-mono" placeholder="Estrutura (JSON: slides ou listas)" />
              )}
            </div>
          ))}
          {error && <p className="text-xs text-[var(--red)]">{error}</p>}
        </div>
      </Modal>
    )
  }

  // --- Passo 1: colar texto ---
  return (
    <Modal
      title="Importar copies"
      onClose={onClose}
      size="lg"
      footer={
        <ModalFooter
          onClose={onClose}
          onConfirm={() => { setError(''); extractMut.mutate() }}
          confirmLabel="Extrair com IA"
          loading={extractMut.isPending}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-[var(--muted)]">
          Cole o documento de copy (formato livre). A IA identifica cada peça pelo ID
          <span className="font-mono text-[var(--ink-soft)]"> [CAMP]-[CANAL]-[FORMATO][NN]</span> e
          distribui título, descrição, CTA, slides de carrossel e blocos de texto. Você revisa antes de salvar.
        </p>
        <div>
          <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Documento de copy</label>
          <Textarea
            placeholder={`📱 META ADS: ...\nID: INVB-M-E01 | Variação 1\nHeadline: ...\nDescrição: ...\nBotão (CTA): ...\nLegenda do Post: ...`}
            value={text}
            onChange={e => setText(e.target.value)}
            rows={14}
            className="font-mono text-xs"
          />
        </div>
        {error && <p className="text-xs text-[var(--red)]">{error}</p>}
      </div>
    </Modal>
  )
}
