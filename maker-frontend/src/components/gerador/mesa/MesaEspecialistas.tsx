import { useState } from 'react'
import { Button } from '../../ui/Button'
import { Textarea } from '../../ui/Input'
import { DotLoader, StatusMsg } from '../ui'
import { OpcaoCard } from './OpcaoCard'
import { useGeradorDispatch, useGeradorState } from '../../../hooks/gerador/useGerador'
import { getSelecaoMesa } from '../../../hooks/gerador/geradorReducer'
import type { MesaId } from '../../../hooks/gerador/geradorReducer'
import { chamarGeradorJSON } from '../../../lib/gerador/ai'
import type { Opcao } from '../../../types/gerador'

export interface MesaEspecialistasProps {
  mesa: MesaId
  promptOpcoes: string
  camposOrdem: [string, string][]
  multi: boolean
  maxTokens?: number
  labelRodar: string
  labelLoading: string
  // Fechuras sobre o estado atual (recriadas a cada render pelo pai).
  buildContexto: () => string
  // Regerar com feedback só existe nas mesas 07/08 do protótipo.
  permitirRegerar?: boolean
  buildContextoRegerar?: (feedback: string, ultimas: Opcao[]) => string
  // Gate de habilitação (ex: estratégia exige perfil confirmado).
  gate?: { enabled: boolean; msg: string }
}

interface OpcoesResposta {
  opcoes: Opcao[]
}

export function MesaEspecialistas(props: MesaEspecialistasProps) {
  const { mesa, promptOpcoes, camposOrdem, multi, maxTokens = 3000, labelRodar, labelLoading } = props
  const state = useGeradorState()
  const dispatch = useGeradorDispatch()

  const opcoes = state.ultimasOpcoesPorMesa[mesa] ?? []
  const confirmadas = getSelecaoMesa(state.decisoes, mesa)

  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ msg: string; error?: boolean } | null>(null)
  const [feedback, setFeedback] = useState('')
  const [sel, setSel] = useState<string[]>(() => confirmadas.map((o) => o.titulo))

  async function rodar(contexto: string, loadingMsg: string) {
    setLoading(true)
    setStatus({ msg: loadingMsg })
    try {
      const json = await chamarGeradorJSON<OpcoesResposta>(promptOpcoes, contexto, maxTokens)
      dispatch({ type: 'SET_OPCOES_MESA', mesa, opcoes: json.opcoes ?? [] })
      setSel([])
      setStatus({
        msg: multi
          ? 'Selecione uma ou mais opções abaixo (clique para marcar/desmarcar) e depois confirme.'
          : 'Escolha uma opção abaixo.',
      })
    } catch (err) {
      setStatus({ msg: 'Erro na mesa: ' + (err instanceof Error ? err.message : String(err)), error: true })
    } finally {
      setLoading(false)
    }
  }

  function onRodar() {
    void rodar(props.buildContexto(), labelLoading)
  }

  function onRegerar() {
    const fb = feedback.trim()
    if (!fb || !props.buildContextoRegerar) {
      setStatus({ msg: 'Descreva o que você quer ajustar nessas opções.', error: true })
      return
    }
    void rodar(props.buildContextoRegerar(fb, opcoes), 'Gerando novas opções…').then(() => setFeedback(''))
  }

  function onCard(op: Opcao) {
    if (multi) {
      setSel((prev) => (prev.includes(op.titulo) ? prev.filter((t) => t !== op.titulo) : [...prev, op.titulo]))
      return
    }
    dispatch({ type: 'CONFIRMAR_MESA', mesa, selecao: [op] })
    setSel([op.titulo])
    setStatus({ msg: `Confirmado: ${op.titulo}.` })
  }

  function confirmarMulti() {
    const selecionadas = opcoes.filter((o) => sel.includes(o.titulo))
    if (!selecionadas.length) {
      setStatus({ msg: 'Selecione pelo menos uma opção antes de confirmar.', error: true })
      return
    }
    dispatch({ type: 'CONFIRMAR_MESA', mesa, selecao: selecionadas })
    setStatus({ msg: `Confirmado: ${selecionadas.map((o) => o.titulo).join(', ')}.` })
  }

  if (props.gate && !props.gate.enabled) {
    return <p className="text-sm text-[var(--muted)]">{props.gate.msg}</p>
  }

  return (
    <div>
      <Button onClick={onRodar} disabled={loading}>
        {loading ? 'Rodando…' : opcoes.length ? 'Rodar novamente' : labelRodar}
      </Button>

      {loading && <div className="mt-3"><DotLoader>{status?.msg}</DotLoader></div>}
      {!loading && status && <StatusMsg error={status.error}>{status.msg}</StatusMsg>}

      {opcoes.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {opcoes.map((op, i) => (
            <OpcaoCard
              key={`${op.titulo}-${i}`}
              opcao={op}
              camposOrdem={camposOrdem}
              selected={multi ? sel.includes(op.titulo) : confirmadas[0]?.titulo === op.titulo}
              onClick={() => onCard(op)}
            />
          ))}
        </div>
      )}

      {opcoes.length > 0 && multi && (
        <Button className="mt-3" onClick={confirmarMulti} disabled={sel.length === 0}>
          Confirmar seleção
        </Button>
      )}

      {opcoes.length > 0 && props.permitirRegerar && (
        <div className="mt-4 pt-4 border-t border-dashed border-[var(--line)]">
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            placeholder="Não gostou das opções? Descreva o ajuste e gere 3 novas."
          />
          <Button variant="secondary" className="mt-2" onClick={onRegerar} disabled={loading}>
            Regerar com ajuste
          </Button>
        </div>
      )}
    </div>
  )
}
