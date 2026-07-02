import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../ui/Button'
import { Select } from '../../ui/Input'
import { limparAutosave, useGeradorDispatch, useGeradorState } from '../../../hooks/gerador/useGerador'
import { desserializarSessao, serializarSessao } from '../../../hooks/gerador/sessao'
import { resetAiTime } from '../../../lib/gerador/timing'
import {
  createDraft,
  deleteDraft,
  getActiveDraftId,
  getDraft,
  listDrafts,
  setActiveDraftId,
  updateDraft,
} from '../../../lib/gerador/drafts'

// Painel de rascunhos persistidos no backend (base de dados), com autosave do
// rascunho ativo. Complementa o autosave em localStorage (que cobre a navegação)
// e o import/export .json manual.
export function DraftsPanel() {
  const state = useGeradorState()
  const dispatch = useGeradorDispatch()
  const qc = useQueryClient()

  const { data: drafts = [] } = useQuery({ queryKey: ['gerador-drafts'], queryFn: listDrafts })
  const [activeId, setActiveId] = useState<number | null>(() => getActiveDraftId())
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const skipAutosave = useRef(true)

  const activeName = drafts.find((d) => d.id === activeId)?.name

  // Autosave do rascunho ativo (debounce). Pula o primeiro efeito após montar/carregar.
  useEffect(() => {
    if (activeId == null) return
    if (skipAutosave.current) {
      skipAutosave.current = false
      return
    }
    const t = setTimeout(() => {
      updateDraft(activeId, { data: JSON.stringify(serializarSessao(state, new Date().toISOString())) })
        .then(() => setStatus('salvo ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })))
        .catch(() => setStatus('falha ao salvar rascunho'))
    }, 2000)
    return () => clearTimeout(t)
  }, [state, activeId])

  function ativar(id: number | null) {
    skipAutosave.current = true
    setActiveId(id)
    setActiveDraftId(id)
  }

  async function salvarComoNovo() {
    const nome = prompt('Nome do rascunho:', state.tituloCampanha || 'Rascunho')
    if (!nome) return
    setBusy(true)
    try {
      const draft = await createDraft(nome, JSON.stringify(serializarSessao(state, new Date().toISOString())))
      ativar(draft.id)
      qc.invalidateQueries({ queryKey: ['gerador-drafts'] })
      setStatus('rascunho criado')
    } finally {
      setBusy(false)
    }
  }

  async function carregar(id: number) {
    if (!id) return
    setBusy(true)
    skipAutosave.current = true // evita re-salvar imediatamente o que acabou de carregar
    try {
      const draft = await getDraft(id)
      dispatch({ type: 'RESTAURAR_SESSAO', sessao: desserializarSessao(draft.data) })
      ativar(id)
      setStatus(`rascunho "${draft.name}" carregado`)
    } catch (e) {
      setStatus('erro ao carregar: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
    }
  }

  function novaCampanha() {
    if (!confirm('Começar uma nova campanha? O rascunho atual será limpo (salve como novo antes se quiser guardá-lo).')) return
    ativar(null) // limpa o rascunho ativo ANTES do reset, para o autosave não sobrescrever
    limparAutosave()
    resetAiTime()
    dispatch({ type: 'RESET' })
    setStatus('nova campanha')
  }

  async function excluir() {
    if (activeId == null) return
    if (!confirm(`Excluir o rascunho "${activeName ?? activeId}"?`)) return
    setBusy(true)
    try {
      await deleteDraft(activeId)
      ativar(null)
      qc.invalidateQueries({ queryKey: ['gerador-drafts'] })
      setStatus('rascunho excluído')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-[var(--muted)]">Rascunhos:</span>
      <Select
        value={activeId ?? ''}
        onChange={(e) => carregar(Number(e.target.value))}
        className="!w-auto !py-1 text-xs"
        disabled={busy}
      >
        <option value="">{drafts.length ? 'Selecionar rascunho…' : 'Nenhum rascunho salvo'}</option>
        {drafts.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </Select>
      <Button variant="secondary" size="sm" onClick={salvarComoNovo} disabled={busy}>Salvar como novo</Button>
      <Button variant="secondary" size="sm" onClick={novaCampanha} disabled={busy}>Nova campanha</Button>
      {activeId != null && (
        <Button variant="danger" size="sm" onClick={excluir} disabled={busy}>Excluir</Button>
      )}
      {activeId != null && <span className="text-xs text-[var(--accent)]">● {activeName} (autosave)</span>}
      {status && <span className="text-xs text-[var(--muted)]">· {status}</span>}
    </div>
  )
}
