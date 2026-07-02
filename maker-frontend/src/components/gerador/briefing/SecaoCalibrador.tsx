import { useState } from 'react'
import { Select, Textarea } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { DotLoader, Field, Hint, Row, StatusMsg, ToggleGroup } from '../ui'
import { useGeradorDispatch, useGeradorState } from '../../../hooks/gerador/useGerador'
import { chamarGerador } from '../../../lib/gerador/ai'
import { PROMPT_CALIBRADOR_ESTILO } from '../../../lib/gerador/prompts'
import type { FormularioState } from '../../../types/gerador'

const OPCOES = {
  atrFormalidade: ['Muito informal', 'Informal', 'Neutro', 'Formal', 'Muito formal'],
  atrComprimento: ['Curtas e diretas', 'Médias, equilibradas', 'Longas e elaboradas'],
  atrCta: ['Sutil e consultivo', 'Direto', 'Muito agressivo/urgente'],
  atrDados: ['Baixo', 'Médio', 'Alto'],
  atrRitmo: ['Staccato — frases curtas, cortes secos', 'Fluido — frases conectadas, cadência'],
}

export function SecaoCalibrador() {
  const f = useGeradorState().formulario
  const dispatch = useGeradorDispatch()
  const set = <K extends keyof FormularioState>(campo: K, valor: FormularioState[K]) =>
    dispatch({ type: 'SET_CAMPO', campo, valor })

  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ msg: string; error?: boolean } | null>(null)

  async function calibrarPorExemplo() {
    const exemplos = f.exemplosCopy.trim()
    if (!exemplos) {
      setStatus({ msg: 'Cole pelo menos um exemplo de copy antes de calibrar.', error: true })
      return
    }
    setLoading(true)
    setStatus(null)
    try {
      const resp = await chamarGerador(
        PROMPT_CALIBRADOR_ESTILO,
        `Exemplos de copy fornecidos como referência de estilo ideal:\n\n${exemplos}`,
        2500,
      )
      set('perfilEstiloTexto', resp.text)
      setStatus({ msg: 'Perfil de estilo extraído — revise/edite abaixo se quiser antes de seguir com a campanha.' })
    } catch (err) {
      setStatus({ msg: 'Erro ao calibrar estilo: ' + (err instanceof Error ? err.message : String(err)), error: true })
    } finally {
      setLoading(false)
    }
  }

  function compilarPorAtributos() {
    const texto = `PERFIL DE ESTILO (definido manualmente):
- Formalidade: ${f.atrFormalidade}
- Comprimento de frase: ${f.atrComprimento}
- Agressividade do CTA: ${f.atrCta}
- Uso de dados/números como prova: ${f.atrDados}
- Ritmo: ${f.atrRitmo}
- Observações adicionais: ${f.atrOutras || 'nenhuma'}`
    set('perfilEstiloTexto', texto)
    setStatus({ msg: 'Perfil de estilo compilado — revise/edite abaixo se quiser antes de seguir com a campanha.' })
  }

  return (
    <>
      <Hint>
        Define o "jeito de escrever" da Boxys nesta campanha — comprimento de frase, ritmo, pontuação,
        vocabulário recorrente e o que nunca se escreve. Opcional, mas se preenchido entra em toda copy
        gerada (Ads, Vídeos, Redes Sociais, LP, App).
      </Hint>

      <ToggleGroup
        value={f.modoEstilo}
        onChange={(v) => set('modoEstilo', v)}
        options={[
          { value: 'exemplo', label: 'Por exemplo' },
          { value: 'atributos', label: 'Por atributos' },
        ]}
      />

      {f.modoEstilo === 'exemplo' ? (
        <div>
          <Field label="Cole 2 a 5 textos de copy que representam o estilo ideal">
            <Textarea
              value={f.exemplosCopy}
              onChange={(e) => set('exemplosCopy', e.target.value)}
              rows={6}
              placeholder="Cole aqui parágrafos ou anúncios reais que você considera o padrão de escrita ideal da Boxys. Quanto mais exemplos, mais preciso fica o perfil extraído."
            />
          </Field>
          <Button variant="secondary" onClick={calibrarPorExemplo} disabled={loading}>
            {loading ? 'Analisando…' : 'Calibrar estilo a partir dos exemplos'}
          </Button>
        </div>
      ) : (
        <div>
          <Row>
            <Field label="Formalidade">
              <Select value={f.atrFormalidade} onChange={(e) => set('atrFormalidade', e.target.value)}>
                {OPCOES.atrFormalidade.map((o) => <option key={o}>{o}</option>)}
              </Select>
            </Field>
            <Field label="Comprimento de frase">
              <Select value={f.atrComprimento} onChange={(e) => set('atrComprimento', e.target.value)}>
                {OPCOES.atrComprimento.map((o) => <option key={o}>{o}</option>)}
              </Select>
            </Field>
          </Row>
          <Row>
            <Field label="Agressividade do CTA">
              <Select value={f.atrCta} onChange={(e) => set('atrCta', e.target.value)}>
                {OPCOES.atrCta.map((o) => <option key={o}>{o}</option>)}
              </Select>
            </Field>
            <Field label="Uso de dados/números como prova">
              <Select value={f.atrDados} onChange={(e) => set('atrDados', e.target.value)}>
                {OPCOES.atrDados.map((o) => <option key={o}>{o}</option>)}
              </Select>
            </Field>
          </Row>
          <Field label="Ritmo">
            <Select value={f.atrRitmo} onChange={(e) => set('atrRitmo', e.target.value)}>
              {OPCOES.atrRitmo.map((o) => <option key={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Outras observações de estilo">
            <Textarea value={f.atrOutras} onChange={(e) => set('atrOutras', e.target.value)} rows={2} placeholder="Ex: gosta de perguntas retóricas / evita exclamações / usa muito travessão..." />
          </Field>
          <Button variant="secondary" onClick={compilarPorAtributos}>Compilar estilo a partir dos atributos</Button>
        </div>
      )}

      {loading && <div className="mt-3"><DotLoader>Analisando os exemplos e extraindo o perfil de estilo…</DotLoader></div>}
      {status && <StatusMsg error={status.error}>{status.msg}</StatusMsg>}

      {f.perfilEstiloTexto && (
        <Field label="Perfil de estilo (editável — ajuste à mão se quiser antes de gerar a campanha)">
          <Textarea value={f.perfilEstiloTexto} onChange={(e) => set('perfilEstiloTexto', e.target.value)} rows={8} />
        </Field>
      )}
    </>
  )
}
