import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import { CopyForm } from './CopyForm'
import { ImportCopiesModal } from './ImportCopiesModal'
import { PromptIAModal } from './PromptIAModal'
import type { LocalCampaign, LocalCopy } from '../../types'

interface Props {
  campaignId: string
  copies: LocalCopy[]
  campaign?: LocalCampaign
}

type CopyType = LocalCopy['type']

const TYPE_BADGE: Record<CopyType, string> = {
  criativo: 'bg-blue-950/50 text-blue-400',
  search: 'bg-amber-950/50 text-amber-400',
  display: 'bg-teal-950/50 text-teal-400',
  pmax: 'bg-rose-950/50 text-rose-400',
  asset: 'bg-slate-800/60 text-slate-300',
  landing_page: 'bg-purple-950/50 text-purple-400',
}

const TYPE_BADGE_LABEL: Record<CopyType, string> = {
  criativo: 'criativo',
  search: 'search',
  display: 'display',
  pmax: 'pmax',
  asset: 'asset',
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

// content_html pode conter HTML (legado) OU JSON estruturado (carrossel/Search/Display/PMax).
// Detecta JSON e renderiza legível; caso contrário trata como HTML.
function ContentHtmlBlock({ raw }: { raw: string }) {
  let parsed: unknown = null
  const trimmed = raw.trim()
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try { parsed = JSON.parse(trimmed) } catch { parsed = null }
  }

  if (Array.isArray(parsed)) {
    return (
      <div>
        <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Slides do carrossel</p>
        <div className="flex flex-col gap-3">
          {parsed.map((slide, i) => (
            <div key={i} className="bg-[var(--surface-raised)] rounded-lg p-3 border border-[var(--line)]">
              <p className="text-xs font-semibold text-[var(--accent)] mb-1">
                Slide {String((slide as Record<string, unknown>).slide ?? i + 1)}
                {(slide as Record<string, unknown>).label ? ` — ${String((slide as Record<string, unknown>).label)}` : ''}
              </p>
              {Object.entries(slide as Record<string, unknown>)
                .filter(([k]) => k !== 'slide' && k !== 'label')
                .map(([k, v]) => (
                  <p key={k} className="text-xs text-[var(--ink-soft)]">
                    <span className="text-[var(--muted)]">{k}:</span> {String(v)}
                  </p>
                ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    return (
      <div>
        <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Blocos de texto</p>
        <div className="flex flex-col gap-3">
          {Object.entries(obj).map(([key, list]) => (
            <div key={key} className="bg-[var(--surface-raised)] rounded-lg p-3 border border-[var(--line)]">
              <p className="text-xs font-semibold text-[var(--accent)] mb-1">{key}</p>
              <ul className="text-xs text-[var(--ink-soft)] list-disc list-inside space-y-0.5">
                {(Array.isArray(list) ? list : [list]).map((item, i) => <li key={i}>{String(item)}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Conteúdo rich-text</p>
      <div
        className="prose prose-sm prose-invert max-w-none text-[var(--ink-soft)] bg-[var(--surface-raised)] rounded-lg p-4 border border-[var(--line)]"
        dangerouslySetInnerHTML={{ __html: raw }}
      />
    </div>
  )
}

function CopyDetailModal({ copy, onEdit, onClose }: { copy: LocalCopy; onEdit: () => void; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end"
      style={{ background: 'rgba(0,0,0,.6)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="h-full w-full max-w-2xl bg-[var(--surface)] border-l border-[var(--line)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line)] flex-none">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-[var(--accent)]">{copy.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${TYPE_BADGE[copy.type]}`}>
                {TYPE_BADGE_LABEL[copy.type]}
              </span>
            </div>
            {copy.title && <p className="text-sm font-semibold text-[var(--ink)] mt-1">{copy.title}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onEdit}>Editar</Button>
            <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--ink)] text-lg leading-none">×</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
          {copy.title && (
            <div>
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-1">Título</p>
              <p className="text-sm text-[var(--ink)]">{copy.title}</p>
            </div>
          )}
          {copy.description && (
            <div>
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-1">Descrição</p>
              <p className="text-sm text-[var(--ink-soft)] whitespace-pre-wrap">{copy.description}</p>
            </div>
          )}
          {copy.message && (
            <div>
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-1">Mensagem / CTA</p>
              <p className="text-sm text-[var(--ink-soft)] italic">"{copy.message}"</p>
            </div>
          )}
          {copy.content && (
            <div>
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-1">Conteúdo</p>
              <pre className="text-xs text-[var(--ink-soft)] font-mono whitespace-pre-wrap bg-[var(--surface-raised)] rounded-lg p-4 border border-[var(--line)]">{copy.content}</pre>
            </div>
          )}
          {copy.content_html && <ContentHtmlBlock raw={copy.content_html} />}
        </div>
      </div>
    </div>
  )
}

function CopyCard({
  copy,
  selected,
  onToggle,
  onOpen,
  onDelete,
}: {
  copy: LocalCopy
  selected: boolean
  onToggle: () => void
  onOpen: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={`bg-[var(--surface)] rounded-[var(--radius)] border transition-all p-4 cursor-pointer hover:border-[var(--ink-soft)] ${
        selected ? 'border-[var(--accent)]' : 'border-[var(--line)]'
      }`}
      onClick={onOpen}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={e => { e.stopPropagation(); onToggle() }}
          onClick={e => e.stopPropagation()}
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
        <div className="flex gap-1.5 flex-none" onClick={e => e.stopPropagation()}>
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

interface PromptModalState {
  groupLabel: string
  promptEndpoint: string
  blocks: string
}

export function CopiesTab({ campaignId, copies, campaign }: Props) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<number[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editCopy, setEditCopy] = useState<LocalCopy | null>(null)
  const [detailCopy, setDetailCopy] = useState<LocalCopy | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [promptModal, setPromptModal] = useState<PromptModalState | null>(null)

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

  // Abre o modal de prompt com IA (contextualizado à campanha) para um grupo inteiro.
  function abrirPromptGrupo(group: PromptGroup) {
    const groupCopies = copies.filter(c => groupOf(c.type) === group)
    if (!groupCopies.length) return
    const blocks = groupCopies.map(formatCopyBlock).join('\n\n---\n\n')
    setPromptModal({ groupLabel: GROUP_LABEL[group], promptEndpoint: GROUP_PROMPT_ENDPOINT[group], blocks })
  }

  // Idem, mas só com as copies selecionadas.
  function abrirPromptSelecionados() {
    const selectedCopies = copies.filter(c => selected.includes(c.id))
    if (!selectedCopies.length) return
    const group = groupOf(selectedCopies[0].type)
    const blocks = selectedCopies.map(formatCopyBlock).join('\n\n---\n\n')
    setPromptModal({ groupLabel: GROUP_LABEL[group], promptEndpoint: GROUP_PROMPT_ENDPOINT[group], blocks })
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
              onClick={() => abrirPromptGrupo('ad_post')}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
            >
              {`Prompt Ad/Post com IA (${adPostCount})`} →
            </button>
          )}
          {lpCount > 0 && (
            <button
              onClick={() => abrirPromptGrupo('lp')}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--line)] text-[var(--ink-soft)] hover:border-purple-400 hover:text-purple-400 transition-all"
            >
              {`Prompt LP com IA (${lpCount})`} →
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
              onOpen={() => setDetailCopy(c)}
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
          <Button size="sm" onClick={abrirPromptSelecionados}>Gerar prompt com IA →</Button>
        </div>
      )}

      {/* Prompt com IA (contextualizado à campanha) */}
      {promptModal && (
        <PromptIAModal
          campaign={campaign}
          groupLabel={promptModal.groupLabel}
          promptEndpoint={promptModal.promptEndpoint}
          blocks={promptModal.blocks}
          onClose={() => setPromptModal(null)}
        />
      )}

      {showCreate && <CopyForm campaignId={campaignId} onClose={() => setShowCreate(false)} />}
      {editCopy && <CopyForm campaignId={campaignId} copy={editCopy} onClose={() => setEditCopy(null)} />}
      {detailCopy && !editCopy && (
        <CopyDetailModal
          copy={detailCopy}
          onEdit={() => { setEditCopy(detailCopy); setDetailCopy(null) }}
          onClose={() => setDetailCopy(null)}
        />
      )}
      {showImport && <ImportCopiesModal campaignId={campaignId} onClose={() => setShowImport(false)} />}
    </div>
  )
}
