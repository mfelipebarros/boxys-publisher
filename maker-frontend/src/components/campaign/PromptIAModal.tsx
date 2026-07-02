import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import { chamarGerador } from '../../lib/gerador/ai'
import type { LocalCampaign } from '../../types'

interface Props {
  campaign?: LocalCampaign
  groupLabel: string
  promptEndpoint: string // 'criativo' | 'lp' — busca o prompt-base
  blocks: string // copies já formatadas em blocos
  onClose: () => void
}

const SYSTEM = `Você é um especialista da Boxys em preparar PROMPTS de geração de criativos (para uso no Claude Design). Você recebe, na mensagem do usuário: (1) um PROMPT-BASE padrão da Boxys, (2) o CONTEXTO desta campanha específica, (3) REFERÊNCIAS e instruções extras do operador, e (4) as COPIES já aprovadas.

Produza um PROMPT FINAL adaptado a ESTA campanha: mantenha a estrutura e a intenção do prompt-base, mas calibre tom, público, ângulo e ênfase de acordo com o contexto; incorpore as referências/instruções extras; e inclua TODAS as copies com seus IDs INTACTOS (não reescreva o texto das copies, não invente nem remova peças). Responda APENAS com o prompt final, pronto para colar — sem comentários, sem markdown de cerca de código.`

function montarContexto(c?: LocalCampaign): string {
  if (!c) return 'Sem contexto de campanha disponível.'
  const partes: string[] = []
  if (c.briefing_text) partes.push(`Briefing:\n${c.briefing_text}`)
  if (c.description) partes.push(`Descrição da campanha: ${c.description}`)
  if (c.target_audience_description) partes.push(`Público-alvo: ${c.target_audience_description}`)
  if (c.usage_instructions) partes.push(`Instruções de uso: ${c.usage_instructions}`)
  return partes.length ? partes.join('\n\n') : 'Sem contexto de campanha preenchido.'
}

export function PromptIAModal({ campaign, groupLabel, promptEndpoint, blocks, onClose }: Props) {
  const [referencias, setReferencias] = useState('')
  const [resultado, setResultado] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)
  const baseRef = useRef<string | null>(null)

  async function gerar() {
    setLoading(true)
    setErro('')
    try {
      if (baseRef.current === null) {
        try {
          const { prompt } = await api.get<{ status: string; prompt: string }>(`/api/prompts/${promptEndpoint}`)
          baseRef.current = prompt || ''
        } catch {
          baseRef.current = ''
        }
      }
      const userText =
        `PROMPT-BASE:\n${baseRef.current || '(sem prompt-base — crie um prompt coerente do zero)'}\n\n` +
        `CONTEXTO DA CAMPANHA:\n${montarContexto(campaign)}\n\n` +
        `REFERÊNCIAS / INSTRUÇÕES EXTRAS:\n${referencias.trim() || 'nenhuma'}\n\n` +
        `COPIES APROVADAS:\n${blocks}`
      const resp = await chamarGerador(SYSTEM, userText, 8000)
      setResultado(resp.text)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  // Gera automaticamente ao abrir.
  useEffect(() => {
    void gerar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(resultado)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      /* o textarea já permite copiar manualmente */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-[var(--surface)] border border-[var(--line)] rounded-[var(--radius)] shadow-[var(--shadow)] flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--line)]">
          <p className="font-semibold text-sm text-[var(--ink)]">Prompt com IA — {groupLabel}</p>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--ink)]">×</button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1.5">Referências / instruções extras (opcional)</label>
            <textarea
              value={referencias}
              onChange={(e) => setReferencias(e.target.value)}
              rows={2}
              placeholder="Ex: seguir o estilo do concorrente X / usar paleta clara / focar no gancho de financiamento..."
              className="w-full bg-[var(--surface-raised)] border border-[var(--line)] rounded-lg px-3 py-2 text-sm text-[var(--ink)] placeholder-[var(--muted)] outline-none focus:border-[var(--accent)]"
            />
            <div className="mt-2">
              <Button size="sm" variant="secondary" onClick={gerar} disabled={loading}>
                {loading ? 'Gerando…' : resultado ? 'Regerar com IA' : 'Gerar com IA'}
              </Button>
            </div>
          </div>

          {erro && <p className="text-xs text-[var(--red)]">Erro ao gerar: {erro}</p>}

          <div>
            <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1.5">Prompt final (editável)</label>
            <textarea
              value={resultado}
              onChange={(e) => setResultado(e.target.value)}
              rows={14}
              placeholder={loading ? 'Gerando prompt contextualizado…' : ''}
              className="w-full font-mono text-xs bg-[var(--surface-raised)] border border-[var(--line)] rounded-lg px-3 py-2 text-[var(--ink-soft)] outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--line)]">
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
          <Button onClick={copiar} disabled={!resultado || loading}>{copiado ? 'Copiado!' : 'Copiar prompt'}</Button>
        </div>
      </div>
    </div>
  )
}
