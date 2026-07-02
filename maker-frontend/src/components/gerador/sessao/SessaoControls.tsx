import { useRef, useState } from 'react'
import { Button } from '../../ui/Button'
import { useGeradorDispatch, useGeradorState } from '../../../hooks/gerador/useGerador'
import { desserializarSessao, serializarSessao } from '../../../hooks/gerador/sessao'
import { slugify } from '../../../lib/gerador/download'

export function SessaoControls() {
  const state = useGeradorState()
  const dispatch = useGeradorDispatch()
  const inputRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  function salvar() {
    const sessao = serializarSessao(state, new Date().toISOString())
    const blob = new Blob([JSON.stringify(sessao, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = slugify(state.tituloCampanha) + '-sessao.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setMsg('Progresso salvo em .json.')
  }

  async function continuar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const texto = await file.text()
      const sessao = desserializarSessao(texto)
      dispatch({ type: 'RESTAURAR_SESSAO', sessao })
      setMsg('Campanha restaurada da sessão salva.')
    } catch (err) {
      setMsg('Erro ao abrir sessão: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" onClick={salvar}>Salvar progresso (.json)</Button>
      <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>Continuar campanha salva</Button>
      <input ref={inputRef} type="file" accept=".json,application/json" className="hidden" onChange={continuar} />
      {msg && <span className="text-xs text-[var(--muted)]">{msg}</span>}
    </div>
  )
}
