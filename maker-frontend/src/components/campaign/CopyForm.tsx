import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import { Input, Textarea, Select } from '../ui/Input'
import { RichTextEditor } from './RichTextEditor'
import type { LocalCopy } from '../../types'

interface Props {
  campaignId: string
  copy?: LocalCopy
  onClose: () => void
}

interface CopyPayload {
  name: string
  title: string
  description: string
  message: string
  type: 'criativo' | 'landing_page' | 'search'
  content: string
  content_html: string
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5 uppercase tracking-wide">
      {children}
    </label>
  )
}

export function CopyForm({ campaignId, copy, onClose }: Props) {
  const qc = useQueryClient()
  const isEdit = !!copy
  const [form, setForm] = useState<CopyPayload>({
    name: copy?.name ?? '',
    title: copy?.title ?? '',
    description: copy?.description ?? '',
    message: copy?.message ?? '',
    type: copy?.type ?? 'criativo',
    content: copy?.content ?? '',
    content_html: copy?.content_html ?? '',
  })
  const [error, setError] = useState('')

  function set<K extends keyof CopyPayload>(field: K, value: CopyPayload[K]) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const isLanding = form.type === 'landing_page'

  const mut = useMutation({
    mutationFn: () => isEdit
      ? api.put(`/api/copies/${copy!.id}`, form)
      : api.post(`/api/campaigns/${campaignId}/copies`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" style={{ background: 'rgba(0,0,0,.6)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="h-full w-full max-w-2xl bg-[var(--surface)] border-l border-[var(--line)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line)] flex-none">
          <div>
            <h2 className="text-base font-semibold text-[var(--ink)]">
              {isEdit ? 'Editar copy' : 'Nova copy'}
            </h2>
            {isEdit && (
              <p className="text-xs text-[var(--muted)] mt-0.5 font-mono">{copy.name}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={() => { setError(''); mut.mutate() }} disabled={mut.isPending}>
              {mut.isPending ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar copy'}
            </Button>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-6">

            {/* ID + Tipo */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>ID da copy</FieldLabel>
                <Input
                  placeholder="ex: var-01"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  autoFocus={!isEdit}
                />
                <p className="text-xs text-[var(--muted)] mt-1">Usado para auto-associação com criativos via metatag.</p>
              </div>
              <div>
                <FieldLabel>Tipo</FieldLabel>
                <Select value={form.type} onChange={e => set('type', e.target.value as 'criativo' | 'landing_page')}>
                  <option value="criativo">Criativo</option>
                  <option value="landing_page">Landing Page</option>
                </Select>
              </div>
            </div>

            {/* Campos de criativo */}
            {!isLanding && (
              <>
                <div>
                  <FieldLabel>Título / Headline</FieldLabel>
                  <Input
                    placeholder="Título principal do anúncio"
                    value={form.title}
                    onChange={e => set('title', e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel>Descrição</FieldLabel>
                  <Textarea
                    placeholder="Descrição completa do anúncio"
                    value={form.description}
                    onChange={e => set('description', e.target.value)}
                    rows={3}
                  />
                </div>
                <div>
                  <FieldLabel>Mensagem / CTA</FieldLabel>
                  <Input
                    placeholder="ex: Clique e saiba mais"
                    value={form.message}
                    onChange={e => set('message', e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Conteúdo texto puro (referência) */}
            <div>
              <FieldLabel>Conteúdo (referência para designers)</FieldLabel>
              <Textarea
                placeholder="Texto de referência para a equipe criativa…"
                value={form.content}
                onChange={e => set('content', e.target.value)}
                rows={isLanding ? 5 : 3}
              />
            </div>

            {/* Rich text */}
            <div>
              <FieldLabel>Conteúdo rich-text</FieldLabel>
              <RichTextEditor
                value={form.content_html}
                onChange={html => set('content_html', html)}
                placeholder={isLanding ? 'Conteúdo completo da landing page…' : 'Conteúdo detalhado da copy…'}
                minHeight={isLanding ? 320 : 200}
              />
            </div>

            {error && (
              <p className="text-xs text-[var(--red)] bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
