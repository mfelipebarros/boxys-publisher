import { useState } from 'react'
import { Button } from '../../ui/Button'
import { Select, Textarea } from '../../ui/Input'
import { DotLoader, Field, Hint, StatusMsg } from '../ui'
import { useGeradorDispatch, useGeradorState } from '../../../hooks/gerador/useGerador'
import { chamarGerador } from '../../../lib/gerador/ai'

// Porta "Pedir ajuste em um bloco já gerado" (html 2405-2438).
export function AjusteBlocoPanel() {
  const state = useGeradorState()
  const dispatch = useGeradorDispatch()
  const blocos = state.blocosRegistro

  const [titulo, setTitulo] = useState(blocos[0]?.titulo ?? '')
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ msg: string; error?: boolean } | null>(null)

  if (!blocos.length) return null

  // Mantém uma seleção válida mesmo que a lista mude.
  const tituloAtual = blocos.some((b) => b.titulo === titulo) ? titulo : blocos[0].titulo

  async function aplicar() {
    const fb = feedback.trim()
    if (!fb) {
      setStatus({ msg: 'Escreva o que você quer ajustar nesse bloco.', error: true })
      return
    }
    const bloco = blocos.find((b) => b.titulo === tituloAtual)
    if (!bloco) return
    setLoading(true)
    setStatus(null)
    try {
      const contextoAjuste =
        `${bloco.meta.userText}\n\n---\n` +
        `VOCÊ JÁ GEROU A SEGUINTE VERSÃO PARA ESTE BLOCO ANTERIORMENTE:\n\n${bloco.markdown}\n\n---\n` +
        `O USUÁRIO REVISOU ESSA VERSÃO E PEDIU O SEGUINTE AJUSTE:\n"${fb}"\n\n` +
        `Reescreva o bloco INTEIRO já incorporando esse ajuste. Mantenha a mesma estrutura, quantidade de peças e IDs da versão anterior, a menos que o ajuste peça explicitamente para mudar isso. Não adicione comentários fora do conteúdo do bloco em si.`
      const resp = await chamarGerador(
        bloco.meta.systemPrompt,
        contextoAjuste,
        Math.max(bloco.meta.maxTokens, 4000),
        bloco.meta.incluirArquivos ? state.arquivos : [],
      )
      dispatch({ type: 'APPEND_BLOCO', titulo: bloco.titulo, markdown: resp.text, meta: bloco.meta })
      setFeedback('')
      setStatus({ msg: `Ajuste aplicado em "${bloco.titulo}" — veja a versão atualizada no documento acima.` })
    } catch (err) {
      setStatus({ msg: 'Erro ao aplicar ajuste: ' + (err instanceof Error ? err.message : String(err)), error: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-6 pt-5 border-t border-[var(--line)]">
      <h3 className="text-sm font-semibold text-[var(--ink)] mb-1">Peça um ajuste em um bloco</h3>
      <Hint>
        Escolha um bloco já gerado, descreva o que mudar, e o sistema reescreve só aquele bloco (mantendo
        IDs e estrutura) sem regenerar a campanha inteira.
      </Hint>
      <Field label="Bloco">
        <Select value={tituloAtual} onChange={(e) => setTitulo(e.target.value)}>
          {blocos.map((b) => (
            <option key={b.titulo} value={b.titulo}>{b.titulo}</option>
          ))}
        </Select>
      </Field>
      <Field label="O que ajustar">
        <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} placeholder="Ex: deixar as headlines mais curtas / trocar o CTA / remover menção a preço..." />
      </Field>
      <Button onClick={aplicar} disabled={loading}>{loading ? 'Aplicando…' : 'Aplicar ajuste'}</Button>
      {loading && <div className="mt-2"><DotLoader>Reescrevendo "{tituloAtual}" com o ajuste pedido…</DotLoader></div>}
      {!loading && status && <StatusMsg error={status.error}>{status.msg}</StatusMsg>}
    </div>
  )
}
