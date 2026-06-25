import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import { CopyForm } from './CopyForm'
import { ImportCopiesModal } from './ImportCopiesModal'
import type { LocalCopy } from '../../types'

interface Props {
  campaignId: string
  copies: LocalCopy[]
}

function CopyCard({
  copy,
  selected,
  onToggle,
  onEdit,
  onDelete,
}: {
  copy: LocalCopy
  selected: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={`bg-[var(--surface)] rounded-[var(--radius)] border transition-all p-4 ${
        selected ? 'border-[var(--accent)]' : 'border-[var(--line)]'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-0.5 accent-[var(--accent)]"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-xs text-[var(--accent)]">{copy.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
              copy.type === 'criativo'
                ? 'bg-blue-950/50 text-blue-400'
                : 'bg-purple-950/50 text-purple-400'
            }`}>
              {copy.type === 'criativo' ? 'criativo' : 'LP'}
            </span>
            {copy.criativo_count !== undefined && copy.criativo_count > 0 && (
              <span className="text-[10px] text-[var(--muted)]">{copy.criativo_count} criativo{copy.criativo_count !== 1 ? 's' : ''}</span>
            )}
          </div>
          {copy.title && <p className="text-sm font-semibold text-[var(--ink)] truncate">{copy.title}</p>}
          {copy.description && <p className="text-xs text-[var(--muted)] mt-0.5 line-clamp-2">{copy.description}</p>}
          {copy.message && (
            <p className="text-xs text-[var(--ink-soft)] mt-1 italic">"{copy.message}"</p>
          )}
        </div>
        <div className="flex gap-1.5 flex-none">
          <Button size="sm" variant="secondary" onClick={onEdit}>Editar</Button>
          <Button size="sm" variant="danger" onClick={onDelete}>×</Button>
        </div>
      </div>
    </div>
  )
}

export function CopiesTab({ campaignId, copies }: Props) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<number[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editCopy, setEditCopy] = useState<LocalCopy | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [promptFallback, setPromptFallback] = useState('')

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/api/copies/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] }),
  })

  function toggleSelect(id: number) {
    const copy = copies.find(c => c.id === id)!
    const firstSelected = copies.find(c => selected.includes(c.id))
    if (firstSelected && firstSelected.type !== copy.type) return
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  function selectAll() {
    const type = copies.find(c => selected.includes(c.id))?.type ?? copies[0]?.type
    if (!type) return
    setSelected(copies.filter(c => c.type === type).map(c => c.id))
  }

  async function gerarPrompt() {
    const selectedCopies = copies.filter(c => selected.includes(c.id))
    if (!selectedCopies.length) return
    const type = selectedCopies[0].type
    try {
      const { prompt } = await api.get<{ status: string; prompt: string }>(`/api/prompts/${type === 'criativo' ? 'criativo' : 'lp'}`)
      const blocks = selectedCopies.map(c => {
        const lines = [`ID: ${c.name}`]
        if (c.title) lines.push(`Título: ${c.title}`)
        if (c.description) lines.push(`Descrição: ${c.description}`)
        if (c.message) lines.push(`Mensagem/CTA: ${c.message}`)
        if (c.content) lines.push(`Conteúdo:\n${c.content}`)
        return lines.join('\n')
      }).join('\n\n---\n\n')
      const final = prompt.replace('[COLAR AQUI O OUTPUT DO APP BOXYS]', blocks)
      try {
        await navigator.clipboard.writeText(final)
        setToastMsg('Prompt copiado!')
        setTimeout(() => setToastMsg(''), 3000)
      } catch {
        setPromptFallback(final)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const selectedType = copies.find(c => selected.includes(c.id))?.type

  return (
    <div>
      {/* Actions */}
      <div className="flex gap-2 mb-6">
        <Button onClick={() => setShowCreate(true)}>+ Nova copy</Button>
        <Button variant="secondary" onClick={() => setShowImport(true)}>Importar texto</Button>
      </div>

      {/* Separator */}
      <div className="h-px bg-[var(--line)] mb-6" />

      {copies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--line)]">
          <p className="font-semibold text-sm text-[var(--ink-soft)]">Nenhuma copy ainda</p>
          <p className="text-xs text-[var(--muted)] mt-1">Crie copies para associar aos criativos.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {copies.map(c => (
            <CopyCard
              key={c.id}
              copy={c}
              selected={selected.includes(c.id)}
              onToggle={() => toggleSelect(c.id)}
              onEdit={() => setEditCopy(c)}
              onDelete={() => {
                if (confirm(`Deletar copy "${c.name}"?`)) deleteMut.mutate(c.id)
              }}
            />
          ))}
        </div>
      )}

      {/* Action bar */}
      {selected.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-[var(--surface-raised)] border border-[var(--line)] rounded-xl px-4 py-3 shadow-xl">
          <span className="text-sm text-[var(--ink-soft)]">
            {selected.length} {selectedType === 'landing_page' ? 'landing page' : 'criativo'}{selected.length !== 1 ? 's' : ''} selecionado{selected.length !== 1 ? 's' : ''}
          </span>
          <button onClick={selectAll} className="text-xs text-[var(--accent)] hover:underline">Selecionar todos</button>
          <button onClick={() => setSelected([])} className="text-xs text-[var(--muted)] hover:text-[var(--ink)]">Limpar</button>
          <Button size="sm" onClick={gerarPrompt}>Gerar prompt →</Button>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--surface-raised)] border border-[var(--line)] rounded-lg px-4 py-2.5 text-sm text-[var(--ink-soft)] shadow-xl">
          {toastMsg}
        </div>
      )}

      {/* Prompt fallback modal */}
      {promptFallback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.7)' }}>
          <div className="w-full max-w-2xl bg-[var(--surface)] border border-[var(--line)] rounded-[var(--radius)] p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-sm text-[var(--ink)]">Prompt gerado</p>
              <button onClick={() => setPromptFallback('')} className="text-[var(--muted)] hover:text-[var(--ink)]">×</button>
            </div>
            <textarea
              readOnly
              value={promptFallback}
              rows={16}
              className="w-full bg-[var(--surface-raised)] border border-[var(--line)] rounded-lg p-3 text-xs font-mono text-[var(--ink-soft)] resize-none outline-none"
              onClick={e => (e.target as HTMLTextAreaElement).select()}
            />
          </div>
        </div>
      )}

      {showCreate && <CopyForm campaignId={campaignId} onClose={() => setShowCreate(false)} />}
      {editCopy && <CopyForm campaignId={campaignId} copy={editCopy} onClose={() => setEditCopy(null)} />}
      {showImport && <ImportCopiesModal campaignId={campaignId} onClose={() => setShowImport(false)} />}
    </div>
  )
}
