import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Modal, ModalFooter } from '../ui/Modal'
import { Input, Select } from '../ui/Input'
import type { BoxyCampaign, LocalCopy } from '../../types'

type PublishType = 'advertisement' | 'social_creative' | 'landing_page'

interface Props {
  creativeId: number
  creativeName: string
  copies: LocalCopy[]
  defaultCopyId?: number | null
  defaultCampaignId?: number | null
  onClose: () => void
}

export function PublishToBoxysModal({
  creativeId, creativeName, copies, defaultCopyId, defaultCampaignId, onClose,
}: Props) {
  const qc = useQueryClient()
  const [type, setType] = useState<PublishType>('advertisement')
  const [campaignId, setCampaignId] = useState(defaultCampaignId ? String(defaultCampaignId) : '')
  const [selectedCopyId, setSelectedCopyId] = useState(defaultCopyId ? String(defaultCopyId) : '')
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Derive title from selected copy or fall back to file name
  const selectedCopy = copies.find(c => String(c.id) === selectedCopyId)
  const derivedTitle = selectedCopy?.title || creativeName

  useEffect(() => {
    setTitle(selectedCopy?.title || creativeName)
  }, [selectedCopyId])  // eslint-disable-line react-hooks/exhaustive-deps

  const { data: boxyData } = useQuery({
    queryKey: ['boxy-campaigns'],
    queryFn: () => api.get<{ campaigns: BoxyCampaign[] }>('/api/boxys/campaigns'),
    staleTime: 60_000,
    enabled: !defaultCampaignId,
  })
  const campaigns = boxyData?.campaigns ?? []

  async function handlePublish() {
    if (!campaignId) { setError('Selecione uma campanha Boxys.'); return }
    if (type === 'landing_page' && !slug.trim()) { setError('Slug é obrigatório para landing pages.'); return }
    setLoading(true); setError('')
    try {
      await api.post('/api/boxys/publish', {
        creative_id: creativeId,
        campaign_id: Number(campaignId),
        type,
        title: (title.trim() || derivedTitle) || undefined,
        slug: type === 'landing_page' ? slug.trim() : undefined,
      })
      qc.invalidateQueries({ queryKey: ['boxy-campaigns'] })
      qc.invalidateQueries({ queryKey: ['boxy-campaign'] })
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao publicar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="Publicar no Boxys"
      onClose={onClose}
      footer={<ModalFooter onClose={onClose} onConfirm={handlePublish} confirmLabel="Publicar" loading={loading} />}
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-[var(--muted)]">
          Criativo: <span className="font-semibold text-[var(--ink-soft)]">{creativeName}</span>
        </p>

        {!defaultCampaignId && (
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Campanha Boxys</label>
            <Select value={campaignId} onChange={e => setCampaignId(e.target.value)}>
              <option value="">Selecionar campanha…</option>
              {campaigns.map(c => (
                <option key={c.id} value={String(c.id)}>{c.title}</option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Tipo de conteúdo</label>
          <div className="grid grid-cols-3 gap-2">
            {(['advertisement', 'social_creative', 'landing_page'] as PublishType[]).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                  type === t
                    ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]'
                    : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--muted)]'
                }`}
              >
                {t === 'advertisement' ? 'Anúncio' : t === 'social_creative' ? 'Social' : 'Landing Page'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Copy</label>
          <Select value={selectedCopyId} onChange={e => setSelectedCopyId(e.target.value)}>
            <option value="">Sem copy vinculada</option>
            {copies.map(c => (
              <option key={c.id} value={String(c.id)}>{c.name}{c.title ? ` — ${c.title}` : ''}</option>
            ))}
          </Select>
          {copies.length === 0 && (
            <p className="text-xs text-[var(--muted)] mt-1">Nenhuma copy criada nesta campanha.</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">
            Título <span className="text-[var(--muted)] font-normal">(opcional)</span>
          </label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={derivedTitle || 'Título do asset'}
          />
          {selectedCopy?.title && title !== selectedCopy.title && (
            <button
              onClick={() => setTitle(selectedCopy.title)}
              className="text-xs text-[var(--accent)] mt-1 hover:underline"
            >
              ← restaurar título da copy
            </button>
          )}
        </div>

        {type === 'landing_page' && (
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">
              Slug <span className="text-[var(--red)]">*</span>
            </label>
            <Input placeholder="ex: aria-mooca-lp" value={slug} onChange={e => setSlug(e.target.value)} />
          </div>
        )}

        {error && (
          <p className="text-xs text-[var(--red)] bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
