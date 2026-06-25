import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import type { LocalCopy } from '../../types/index.ts'

interface SearchAds {
  titles: string
  descriptions: string
  keywords: string
}

interface Props {
  campaignId: string
  copies?: LocalCopy[]
}

const MAX_TITLE_CHARS = 30
const MAX_DESC_CHARS = 90
const MAX_TITLES = 15
const MAX_DESCS = 4

function countLines(text: string) {
  return text.split('\n').filter(l => l.trim()).length
}

function LimitBadge({ count, max, label }: { count: number; max: number; label: string }) {
  const over = count > max
  return (
    <span className={`text-xs font-semibold tabular-nums ${over ? 'text-[var(--red)]' : count >= max ? 'text-[var(--amber)]' : 'text-[var(--muted)]'}`}>
      {count}/{max} {label}
    </span>
  )
}

function charWarnings(text: string, limit: number): string[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > limit)
    .map(l => `"${l.slice(0, 20)}…" (${l.length} chars)`)
}

export function SearchTab({ campaignId, copies = [] }: Props) {
  const qc = useQueryClient()
  const [form, setForm] = useState<SearchAds>({ titles: '', descriptions: '', keywords: '' })
  const [saved, setSaved] = useState(false)
  const [imported, setImported] = useState<number | null>(null)

  const { data } = useQuery({
    queryKey: ['search-ads', campaignId],
    queryFn: () => api.get<{ search: SearchAds }>(`/api/campaigns/${campaignId}/search`),
  })

  useEffect(() => {
    if (data?.search) setForm(data.search)
  }, [data])

  const saveMut = useMutation({
    mutationFn: () => api.put(`/api/campaigns/${campaignId}/search`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['search-ads', campaignId] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const searchCopies = copies.filter(c => c.type === 'search')

  function importCopy(copy: LocalCopy) {
    setForm(f => ({
      titles: copy.title?.trim() || f.titles,
      descriptions: copy.description?.trim() || f.descriptions,
      keywords: copy.message?.trim() || f.keywords,
    }))
    setImported(copy.id)
    setTimeout(() => setImported(null), 2000)
  }

  const titleCount = countLines(form.titles)
  const descCount = countLines(form.descriptions)
  const titleWarnings = charWarnings(form.titles, MAX_TITLE_CHARS)
  const descWarnings = charWarnings(form.descriptions, MAX_DESC_CHARS)

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-semibold text-[var(--ink)]">Google Search Ads</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">Um item por linha. Usado na publicação de campanhas Search.</p>
        </div>
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          {saveMut.isPending ? 'Salvando…' : saved ? '✓ Salvo' : 'Salvar'}
        </Button>
      </div>

      {/* Search copies import panel */}
      {searchCopies.length > 0 && (
        <div className="mb-6 p-4 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)]">
          <p className="text-xs font-semibold text-[var(--muted)] mb-3 uppercase tracking-wider">
            Copies de Search disponíveis
          </p>
          <div className="flex flex-col gap-2">
            {searchCopies.map(copy => (
              <div key={copy.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[var(--surface-raised)]">
                <div className="min-w-0">
                  <p className="text-xs font-mono text-[var(--accent)] truncate">{copy.name}</p>
                  {copy.title && (
                    <p className="text-xs text-[var(--muted)] truncate mt-0.5">{copy.title.split('\n')[0]}</p>
                  )}
                </div>
                <button
                  onClick={() => importCopy(copy)}
                  className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                    imported === copy.id
                      ? 'bg-green-900/40 text-green-400'
                      : 'bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white'
                  }`}
                >
                  {imported === copy.id ? '✓ Importado' : 'Importar'}
                </button>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[var(--muted)] mt-2">
            Título → Títulos · Descrição → Descrições · Mensagem → Keywords
          </p>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* Titles */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-[var(--muted)]">
              Títulos <span className="text-[var(--muted)] font-normal">(máx. {MAX_TITLE_CHARS} chars cada)</span>
            </label>
            <LimitBadge count={titleCount} max={MAX_TITLES} label="títulos" />
          </div>
          <textarea
            value={form.titles}
            onChange={e => setForm(f => ({ ...f, titles: e.target.value }))}
            rows={10}
            placeholder={`Título 1\nTítulo 2\nTítulo 3\n…`}
            className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-[var(--radius)] px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] resize-y font-mono"
          />
          {titleWarnings.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {titleWarnings.map((w, i) => (
                <p key={i} className="text-xs text-[var(--amber)]">⚠ {w}</p>
              ))}
            </div>
          )}
        </div>

        {/* Descriptions */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-[var(--muted)]">
              Descrições <span className="text-[var(--muted)] font-normal">(máx. {MAX_DESC_CHARS} chars cada)</span>
            </label>
            <LimitBadge count={descCount} max={MAX_DESCS} label="descrições" />
          </div>
          <textarea
            value={form.descriptions}
            onChange={e => setForm(f => ({ ...f, descriptions: e.target.value }))}
            rows={5}
            placeholder={`Descrição 1\nDescrição 2\n…`}
            className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-[var(--radius)] px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] resize-y font-mono"
          />
          {descWarnings.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {descWarnings.map((w, i) => (
                <p key={i} className="text-xs text-[var(--amber)]">⚠ {w}</p>
              ))}
            </div>
          )}
        </div>

        {/* Keywords */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-[var(--muted)]">Palavras-chave</label>
            <span className="text-xs text-[var(--muted)]">{countLines(form.keywords)} keywords</span>
          </div>
          <textarea
            value={form.keywords}
            onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
            rows={6}
            placeholder={`empreendimento mooca\napartamento são paulo\n…`}
            className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-[var(--radius)] px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] resize-y font-mono"
          />
        </div>
      </div>
    </div>
  )
}
