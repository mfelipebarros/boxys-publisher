// API dos rascunhos do Gerador (base de dados no backend) + rastreio do rascunho
// ativo em localStorage (sobrevive à navegação, junto com o autosave).
import { api } from '../api'

export interface DraftMeta {
  id: number
  name: string
  created_at: string
  updated_at: string
}
export interface DraftFull extends DraftMeta {
  data: string // JSON string da sessão
}

export function listDrafts(): Promise<DraftMeta[]> {
  return api.get<{ status: string; drafts: DraftMeta[] }>('/api/gerador/drafts').then((r) => r.drafts)
}

export function createDraft(name: string, data: string): Promise<DraftFull> {
  return api.post<{ status: string; draft: DraftFull }>('/api/gerador/drafts', { name, data }).then((r) => r.draft)
}

export function getDraft(id: number): Promise<DraftFull> {
  return api.get<{ status: string; draft: DraftFull }>(`/api/gerador/drafts/${id}`).then((r) => r.draft)
}

export function updateDraft(id: number, patch: { name?: string; data?: string }): Promise<DraftFull> {
  return api.put<{ status: string; draft: DraftFull }>(`/api/gerador/drafts/${id}`, patch).then((r) => r.draft)
}

export function deleteDraft(id: number): Promise<void> {
  return api.delete(`/api/gerador/drafts/${id}`).then(() => undefined)
}

const ACTIVE_KEY = 'gerador_active_draft'

export function getActiveDraftId(): number | null {
  try {
    const v = localStorage.getItem(ACTIVE_KEY)
    return v ? Number(v) : null
  } catch {
    return null
  }
}

export function setActiveDraftId(id: number | null): void {
  try {
    if (id == null) localStorage.removeItem(ACTIVE_KEY)
    else localStorage.setItem(ACTIVE_KEY, String(id))
  } catch {
    /* ignora */
  }
}
