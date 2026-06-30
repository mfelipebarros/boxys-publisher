import { useState, useRef } from 'react'
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

interface ExtractedCampaign {
  description: string
  target_audience_description: string
  usage_instructions: string
  one_liner: string
  campaign_type: string
  broker_profile: string
  clear_description: string
}

interface ExtractResult {
  status: string
  campaign: ExtractedCampaign
  copies: ExtractedCopy[]
  error?: string
}

interface BulkResult {
  status: string
  created: number
}

const TYPE_OPTIONS: CopyType[] = ['criativo', 'search', 'display', 'pmax', 'landing_page', 'asset']
const ACCEPT = '.txt,.md,.markdown,.docx,.pdf'

function isClientReadable(name: string) {
  return /\.(txt|md|markdown)$/i.test(name)
}

export function ImportCopiesModal({ campaignId, onClose }: Props) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [campaign, setCampaign] = useState<ExtractedCampaign | null>(null)
  const [rows, setRows] = useState<ExtractedCopy[] | null>(null)
  const [saved, setSaved] = useState<number | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const extractMut = useMutation({
    mutationFn: async (): Promise<ExtractResult> => {
      const file = fileRef.current?.files?.[0]
      if (file && !isClientReadable(file.name)) {
        const fd = new FormData()
        fd.append('file', file)
        return api.upload<ExtractResult>(`/api/campaigns/${campaignId}/copies/extract-file`, fd)
      }
      const payload = file ? await file.text() : text
      return api.post<ExtractResult>(`/api/campaigns/${campaignId}/copies/extract`, { text: payload })
    },
    onSuccess: (data) => {
      if (!data.copies?.length) { setError('A IA não encontrou nenhuma copy no documento.'); return }
      setCampaign(data.campaign)
      setRows(data.copies)
    },
    onError: (e: Error) => setError(e.message),
  })

  const saveMut = useMutation({
    mutationFn: () =>
      api.post<BulkResult>(`/api/campaigns/${campaignId}/copies/bulk`, { copies: rows, campaign }),
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
  function setCamp(field: keyof ExtractedCampaign, value: string) {
    setCampaign(c => c ? { ...c, [field]: value } : c)
  }

  function onPickFile(f: File | undefined) {
    setFileName(f?.name ?? '')
    if (f) setText('')
  }

  // --- Resultado final ---
  if (saved !== null) {
    return (
      <Modal
        title="Importado"
        onClose={onClose}
        footer={<button onClick={onClose} className="text-sm text-[var(--accent)] hover:underline">Fechar</button>}
      >
        <p className="text-sm text-[var(--ink-soft)]">
          <span className="font-semibold text-[var(--ink)]">{saved}</span> cop{saved !== 1 ? 'ies' : 'y'} criada{saved !== 1 ? 's' : ''} e dados da campanha atualizados.
        </p>
      </Modal>
    )
  }

  // --- Passo 2: revisão ---
  if (rows && campaign) {
    const inputCls = 'w-full bg-[var(--surface)] border border-[var(--line)] rounded-lg px-3 py-2 text-xs text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]'
    return (
      <Modal
        title={`Revisar — campanha + ${rows.length} copies`}
        onClose={onClose}
        size="xl"
        footer={
          <ModalFooter
            onClose={() => { setRows(null); setCampaign(null); setError('') }}
            onConfirm={() => { setError(''); saveMut.mutate() }}
            confirmLabel={`Salvar tudo`}
            loading={saveMut.isPending}
          />
        }
      >
        <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
          {/* Campanha */}
          <div className="bg-[var(--surface-raised)] rounded-lg p-3 border border-[var(--accent)]/40 flex flex-col gap-2">
            <p className="text-xs font-bold text-[var(--ink)] uppercase tracking-wide">Campanha (descrição + verso)</p>
            <label className="text-[11px] text-[var(--muted)]">O que é esta campanha?</label>
            <Textarea value={campaign.description} onChange={e => setCamp('description', e.target.value)} rows={2} className="text-xs" />
            <label className="text-[11px] text-[var(--muted)]">Para quem é esta campanha?</label>
            <Textarea value={campaign.target_audience_description} onChange={e => setCamp('target_audience_description', e.target.value)} rows={2} className="text-xs" />
            <label className="text-[11px] text-[var(--muted)]">Como ela deve ser usada?</label>
            <Textarea value={campaign.usage_instructions} onChange={e => setCamp('usage_instructions', e.target.value)} rows={2} className="text-xs" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[var(--muted)]">Frase da campanha (verso)</label>
                <input value={campaign.one_liner} onChange={e => setCamp('one_liner', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] text-[var(--muted)]">Tipo de campanha</label>
                <input value={campaign.campaign_type} onChange={e => setCamp('campaign_type', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] text-[var(--muted)]">Perfil de corretor</label>
                <input value={campaign.broker_profile} onChange={e => setCamp('broker_profile', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] text-[var(--muted)]">Descrição clara (verso)</label>
                <input value={campaign.clear_description} onChange={e => setCamp('clear_description', e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          <p className="text-xs text-[var(--muted)]">Revise as copies. Edite qualquer campo ou remova linhas antes de salvar.</p>
          {rows.map((r, i) => (
            <div key={i} className="bg-[var(--surface-raised)] rounded-lg p-3 border border-[var(--line)] flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Input value={r.name} onChange={e => updateRow(i, { name: e.target.value })} className="font-mono text-xs flex-1" placeholder="ID (ex: INVB-M-E01)" />
                <Select value={r.type} onChange={e => updateRow(i, { type: e.target.value as CopyType })} className="text-xs w-36">
                  {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
                <button onClick={() => removeRow(i)} className="text-[var(--muted)] hover:text-[var(--red)] text-lg leading-none px-1" title="Remover">×</button>
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

  // --- Passo 1: colar ou enviar documento ---
  const hasInput = !!fileName || !!text.trim()
  return (
    <Modal
      title="Importar copies"
      onClose={onClose}
      size="lg"
      footer={
        <ModalFooter
          onClose={onClose}
          onConfirm={() => { if (hasInput) { setError(''); extractMut.mutate() } }}
          confirmLabel="Extrair com IA"
          loading={extractMut.isPending}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-[var(--muted)]">
          Envie um documento (.txt, .md, .docx, .pdf) ou cole o texto. A IA extrai a descrição da campanha,
          a frase do verso e todas as copies (identificadas pelo ID
          <span className="font-mono text-[var(--ink-soft)]"> [CAMP]-[CANAL]-[FORMATO][NN]</span>). Você revisa antes de salvar.
        </p>

        {/* Upload */}
        <div
          onClick={() => fileRef.current?.click()}
          className="cursor-pointer rounded-[var(--radius)] border-2 border-dashed border-[var(--line)] hover:border-[var(--accent)] transition-colors py-6 flex flex-col items-center gap-1 text-[var(--muted)]"
        >
          <span className="text-2xl">📄</span>
          <span className="text-xs">{fileName || 'Clique para enviar um documento'}</span>
          <span className="text-[10px]">.txt · .md · .docx · .pdf</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={e => onPickFile(e.target.files?.[0])}
        />

        <div className="flex items-center gap-2 text-[10px] text-[var(--muted)] uppercase tracking-wide">
          <div className="h-px bg-[var(--line)] flex-1" /> ou cole o texto <div className="h-px bg-[var(--line)] flex-1" />
        </div>

        <Textarea
          placeholder={`📱 META ADS: ...\nID: INVB-M-E01 | Variação 1\nHeadline: ...\nDescrição: ...\nBotão (CTA): ...\nLegenda do Post: ...`}
          value={text}
          onChange={e => { setText(e.target.value); if (e.target.value) { setFileName(''); if (fileRef.current) fileRef.current.value = '' } }}
          rows={10}
          className="font-mono text-xs"
        />
        {error && <p className="text-xs text-[var(--red)]">{error}</p>}
      </div>
    </Modal>
  )
}
