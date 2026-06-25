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

type CopyType = LocalCopy['type']

const TYPE_BADGE: Record<CopyType, string> = {
  criativo: 'bg-blue-950/50 text-blue-400',
  search: 'bg-amber-950/50 text-amber-400',
  landing_page: 'bg-purple-950/50 text-purple-400',
}

const TYPE_BADGE_LABEL: Record<CopyType, string> = {
  criativo: 'criativo',
  search: 'search',
  landing_page: 'LP',
}

function formatCopyBlock(c: LocalCopy): string {
  const lines = [`ID: ${c.name}`]
  if (c.title) lines.push(`Título: ${c.title}`)
  if (c.description) lines.push(`Descrição: ${c.description}`)
  if (c.message) lines.push(`Mensagem/CTA: ${c.message}`)
  if (c.content) lines.push(`Conteúdo:\n${c.content}`)
  return lines.join('\n')
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
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${TYPE_BADGE[copy.type]}`}>
              {TYPE_BADGE_LABEL[copy.type]}
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

// Groups: 'ad_post' = criativo + search, 'lp' = landing_page
type PromptGroup = 'ad_post' | 'lp'

const GROUP_LABEL: Record<PromptGroup, string> = {
  ad_post: 'Ad / Post',
  lp: 'Landing Page',
}

const GROUP_PROMPT_ENDPOINT: Record<PromptGroup, string> = {
  ad_post: 'criativo',
  lp: 'lp',
}

function groupOf(type: CopyType): PromptGroup {
  return type === 'landing_page' ? 'lp' : 'ad_post'
}

export function CopiesTab({ campaignId, copies }: Props) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<number[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editCopy, setEditCopy] = useState<LocalCopy | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [promptFallback, setPromptFallback] = useState<{ title: string; text: string } | null>(null)
  const [copying, setCopying] = useState<PromptGroup | null>(null)

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/api/copies/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] }),
  })

  function toggleSelect(id: number) {
    const copy = copies.find(c => c.id === id)!
    const firstSelected = copies.find(c => selected.includes(c.id))
    if (firstSelected && groupOf(firstSelected.type) !== groupOf(copy.type)) return
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  function toast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

  async function copiarPromptGrupo(group: PromptGroup) {
    const groupCopies = copies.filter(c => groupOf(c.type) === group)
    if (!groupCopies.length) return
    setCopying(group)
    try {
      const endpoint = GROUP_PROMPT_ENDPOINT[group]
      const { prompt } = await api.get<{ status: string; prompt: string }>(`/api/prompts/${endpoint}`)
      const blocks = groupCopies.map(formatCopyBlock).join('\n\n---\n\n')
      const final = prompt.replace('[COLAR AQUI O OUTPUT DO APP BOXYS]', blocks)
      try {
        await navigator.clipboard.writeText(final)
        toast(`Prompt ${GROUP_LABEL[group]} copiado!`)
      } catch {
        setPromptFallback({ title: `Prompt — ${GROUP_LABEL[group]}`, text: final })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCopying(null)
    }
  }

  async function gerarPromptSelecionados() {
    const selectedCopies = copies.filter(c => selected.includes(c.id))
    if (!selectedCopies.length) return
    const group = groupOf(selectedCopies[0].type)
    setCopying(group)
    try {
      const { prompt } = await api.get<{ status: string; prompt: string }>(`/api/prompts/${GROUP_PROMPT_ENDPOINT[group]}`)
      const blocks = selectedCopies.map(formatCopyBlock).join('\n\n---\n\n')
      const final = prompt.replace('[COLAR AQUI O OUTPUT DO APP BOXYS]', blocks)
      try {
        await navigator.clipboard.writeText(final)
        toast('Prompt copiado!')
      } catch {
        setPromptFallback({ title: `Prompt — ${GROUP_LABEL[group]}`, text: final })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCopying(null)
    }
  }

  const adPostCount = copies.filter(c => groupOf(c.type) === 'ad_post').length
  const lpCount = copies.filter(c => groupOf(c.type) === 'lp').length
  const selectedGroup = copies.find(c => selected.includes(c.id)) ? groupOf(copies.find(c => selected.includes(c.id))!.type) : null

  return (
    <div>
      {/* Top actions */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Button onClick={() => setShowCreate(true)}>+ Nova copy</Button>
        <Button variant="secondary" onClick={() => setShowImport(true)}>Importar texto</Button>

        <div className="ml-auto flex gap-2">
          {adPostCount > 0 && (
            <button
              onClick={() => copiarPromptGrupo('ad_post')}
              disabled={copying === 'ad_post'}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50 transition-all"
            >
              {copying === 'ad_post' ? 'Copiando…' : `Copiar prompt Ad/Post (${adPostCount})`} →
            </button>
          )}
          {lpCount > 0 && (
            <button
              onClick={() => copiarPromptGrupo('lp')}
              disabled={copying === 'lp'}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--line)] text-[var(--ink-soft)] hover:border-purple-400 hover:text-purple-400 disabled:opacity-50 transition-all"
            >
              {copying === 'lp' ? 'Copiando…' : `Copiar prompt LP (${lpCount})`} →
            </button>
          )}
        </div>
      </div>

      <div className="h-px bg-[var(--line)] mb-6" />

      {copies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--line)]">
          <p className="font-semibold text-sm text-[var(--ink-soft)]">Nenhuma copy ainda</p>
          <p className="text-xs text-[var(--muted)] mt-1">Crie ou importe copies para associar aos criativos.</p>
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

      {/* Floating action bar for selected subset */}
      {selected.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-[var(--surface-raised)] border border-[var(--line)] rounded-xl px-4 py-3 shadow-xl">
          <span className="text-sm text-[var(--ink-soft)]">
            {selected.length} {selectedGroup === 'lp' ? 'LP' : 'criativo'}{selected.length !== 1 ? 's' : ''} selecionado{selected.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setSelected(copies.filter(c => selectedGroup && groupOf(c.type) === selectedGroup).map(c => c.id))}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            Selecionar todos do grupo
          </button>
          <button onClick={() => setSelected([])} className="text-xs text-[var(--muted)] hover:text-[var(--ink)]">Limpar</button>
          <Button size="sm" onClick={gerarPromptSelecionados} disabled={copying !== null}>
            {copying ? 'Copiando…' : 'Gerar prompt →'}
          </Button>
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
              <p className="font-semibold text-sm text-[var(--ink)]">{promptFallback.title}</p>
              <button onClick={() => setPromptFallback(null)} className="text-[var(--muted)] hover:text-[var(--ink)]">×</button>
            </div>
            <textarea
              readOnly
              value={promptFallback.text}
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
