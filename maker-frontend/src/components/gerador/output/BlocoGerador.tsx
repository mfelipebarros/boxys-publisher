import { useState } from 'react'
import { Button } from '../../ui/Button'
import { DotLoader, StatusMsg } from '../ui'
import { addAiTime, formatDuration } from '../../../lib/gerador/timing'
import { useElapsedTimer } from '../../../hooks/gerador/useAiTiming'

// Botão de geração de bloco final (porta os btnGerar* + sinalizarGeracao).
// onGerar recebe um reporter de progresso e faz as chamadas + dispatch de APPEND_BLOCO.
export function BlocoGerador({
  label,
  successMsg,
  gate,
  onGerar,
}: {
  label: string
  successMsg: string
  gate?: { enabled: boolean; msg: string }
  onGerar: (progress: (msg: string) => void) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [progresso, setProgresso] = useState('')
  const [status, setStatus] = useState<{ msg: string; error?: boolean } | null>(null)
  const [count, setCount] = useState(0)
  const [ultimaDuracao, setUltimaDuracao] = useState<number | null>(null)
  const elapsed = useElapsedTimer(loading)

  async function onClick() {
    const inicio = Date.now()
    setLoading(true)
    setStatus(null)
    try {
      await onGerar(setProgresso)
      const duracao = Date.now() - inicio
      addAiTime(duracao)
      setUltimaDuracao(duracao)
      setCount((c) => c + 1)
      setStatus({ msg: `${successMsg} (${formatDuration(duracao)})` })
    } catch (err) {
      addAiTime(Date.now() - inicio)
      setStatus({ msg: 'Erro ao gerar: ' + (err instanceof Error ? err.message : String(err)) + ' — pode clicar novamente para tentar de novo.', error: true })
    } finally {
      setLoading(false)
      setProgresso('')
    }
  }

  if (gate && !gate.enabled) {
    return <p className="text-sm text-[var(--muted)] mt-3">{gate.msg}</p>
  }

  const badge = count > 0 ? `✓ Gerado${count > 1 ? ` (${count}x)` : ''}${ultimaDuracao != null ? ` · ${formatDuration(ultimaDuracao)}` : ''}` : null

  return (
    <div className="mt-3">
      <Button onClick={onClick} disabled={loading}>
        {loading ? `Gerando… ${formatDuration(elapsed)}` : label}
        {badge && <span className="ml-2 text-[10px] font-bold bg-white/20 rounded px-1.5 py-0.5">{badge}</span>}
      </Button>
      {loading && progresso && <div className="mt-2"><DotLoader>{progresso}</DotLoader></div>}
      {!loading && status && <StatusMsg error={status.error}>{status.msg}</StatusMsg>}
    </div>
  )
}
