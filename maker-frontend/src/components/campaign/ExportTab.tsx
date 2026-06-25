import { useState } from 'react'
import { Button } from '../ui/Button'
import { Select } from '../ui/Input'
import { Input } from '../ui/Input'
import type { LocalCreative, LocalCarousel, LocalCopy } from '../../types'
import { supabase } from '../../lib/supabase'

interface Props {
  campaignId: string
  creatives: LocalCreative[]
  carousels: LocalCarousel[]
  copies: LocalCopy[]
}

async function downloadZip(path: string, body: unknown, filename: string) {
  const { data: session } = await supabase.auth.getSession()
  const token = session?.session?.access_token
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--line)] p-6">
      <h3 className="font-semibold text-sm text-[var(--ink)] mb-4">{title}</h3>
      {children}
    </div>
  )
}

function CopyFields({
  copies,
  copyId,
  onCopyChange,
  title,
  description,
  message,
  onChange,
}: {
  copies: LocalCopy[]
  copyId: string
  onCopyChange: (id: string) => void
  title: string
  description: string
  message: string
  onChange: (field: 'title' | 'description' | 'message', value: string) => void
}) {
  const selectedCopy = copies.find(c => String(c.id) === copyId)

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Copy (opcional)</label>
        <Select value={copyId} onChange={e => onCopyChange(e.target.value)}>
          <option value="">— manual —</option>
          {copies.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </Select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Título</label>
        <Input
          value={selectedCopy?.title ?? title}
          disabled={!!selectedCopy}
          onChange={e => onChange('title', e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Descrição</label>
        <Input
          value={selectedCopy?.description ?? description}
          disabled={!!selectedCopy}
          onChange={e => onChange('description', e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Mensagem / CTA</label>
        <Input
          value={selectedCopy?.message ?? message}
          disabled={!!selectedCopy}
          onChange={e => onChange('message', e.target.value)}
        />
      </div>
    </div>
  )
}

export function ExportTab({ campaignId, creatives, carousels, copies }: Props) {
  const videoCreatives = creatives.filter(c => c.type === 'video')

  // Video form
  const [videoCreativeId, setVideoCreativeId] = useState('')
  const [videoCopyId, setVideoCopyId] = useState('')
  const [videoTitle, setVideoTitle] = useState('')
  const [videoDesc, setVideoDesc] = useState('')
  const [videoMsg, setVideoMsg] = useState('')
  const [videoLoading, setVideoLoading] = useState(false)
  const [videoError, setVideoError] = useState('')

  // Carousel form
  const [carouselId, setCarouselId] = useState('')
  const [carouselVariant, setCarouselVariant] = useState('')
  const [carouselCopyId, setCarouselCopyId] = useState('')
  const [carouselTitle, setCarouselTitle] = useState('')
  const [carouselDesc, setCarouselDesc] = useState('')
  const [carouselMsg, setCarouselMsg] = useState('')
  const [carouselLoading, setCarouselLoading] = useState(false)
  const [carouselError, setCarouselError] = useState('')

  async function exportVideo() {
    if (!videoCreativeId) return
    setVideoLoading(true)
    setVideoError('')
    try {
      const copy = copies.find(c => String(c.id) === videoCopyId)
      await downloadZip('/api/export/zip', {
        campaign_id: Number(campaignId),
        format: 'video',
        creative_id: Number(videoCreativeId),
        title: copy?.title ?? videoTitle,
        description: copy?.description ?? videoDesc,
        message: copy?.message ?? videoMsg,
      }, `export-video-${videoCreativeId}.zip`)
    } catch (e: unknown) {
      setVideoError(e instanceof Error ? e.message : 'Erro ao exportar')
    } finally {
      setVideoLoading(false)
    }
  }

  async function exportCarousel() {
    if (!carouselId) return
    setCarouselLoading(true)
    setCarouselError('')
    try {
      const copy = copies.find(c => String(c.id) === carouselCopyId)
      await downloadZip('/api/export/zip', {
        campaign_id: Number(campaignId),
        format: 'carousel',
        carousel_id: Number(carouselId),
        carousel_variant: carouselVariant,
        title: copy?.title ?? carouselTitle,
        description: copy?.description ?? carouselDesc,
        message: copy?.message ?? carouselMsg,
      }, `export-carousel-${carouselId}.zip`)
    } catch (e: unknown) {
      setCarouselError(e instanceof Error ? e.message : 'Erro ao exportar')
    } finally {
      setCarouselLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Video */}
      <FormSection title="Export — Vídeo">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Criativo de vídeo</label>
            <Select value={videoCreativeId} onChange={e => setVideoCreativeId(e.target.value)}>
              <option value="">Selecionar…</option>
              {videoCreatives.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </Select>
            {videoCreatives.length === 0 && (
              <p className="text-xs text-[var(--muted)] mt-1">Nenhum criativo de vídeo nesta campanha.</p>
            )}
          </div>
          <CopyFields
            copies={copies}
            copyId={videoCopyId}
            onCopyChange={setVideoCopyId}
            title={videoTitle}
            description={videoDesc}
            message={videoMsg}
            onChange={(f, v) => {
              if (f === 'title') setVideoTitle(v)
              else if (f === 'description') setVideoDesc(v)
              else setVideoMsg(v)
            }}
          />
          {videoError && <p className="text-xs text-[var(--red)]">{videoError}</p>}
          <Button onClick={exportVideo} disabled={!videoCreativeId || videoLoading}>
            {videoLoading ? 'Exportando…' : '↓ Exportar ZIP vídeo'}
          </Button>
        </div>
      </FormSection>

      {/* Carousel */}
      <FormSection title="Export — Carrossel">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Carrossel</label>
              <Select value={carouselId} onChange={e => setCarouselId(e.target.value)}>
                <option value="">Selecionar…</option>
                {carousels.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Variante</label>
              <Input
                placeholder="ex: feed, stories"
                value={carouselVariant}
                onChange={e => setCarouselVariant(e.target.value)}
              />
            </div>
          </div>
          <CopyFields
            copies={copies}
            copyId={carouselCopyId}
            onCopyChange={setCarouselCopyId}
            title={carouselTitle}
            description={carouselDesc}
            message={carouselMsg}
            onChange={(f, v) => {
              if (f === 'title') setCarouselTitle(v)
              else if (f === 'description') setCarouselDesc(v)
              else setCarouselMsg(v)
            }}
          />
          {carouselError && <p className="text-xs text-[var(--red)]">{carouselError}</p>}
          <Button onClick={exportCarousel} disabled={!carouselId || carouselLoading}>
            {carouselLoading ? 'Exportando…' : '↓ Exportar ZIP carrossel'}
          </Button>
        </div>
      </FormSection>
    </div>
  )
}
