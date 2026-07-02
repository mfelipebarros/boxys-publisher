// Helper de geração de bloco: chama o proxy, grava o texto (se aplicável) e
// registra o bloco no estado (APPEND_BLOCO com meta para o ajuste posterior).
import { useGeradorDispatch, useGeradorState } from './useGerador'
import type { TextoGeradoKey } from './geradorReducer'
import { chamarGerador } from '../../lib/gerador/ai'

export function useGerarBloco() {
  const state = useGeradorState()
  const dispatch = useGeradorDispatch()

  return async function gerar(
    prompt: string,
    userText: string,
    maxTokens: number,
    incluirArquivos: boolean,
    titulo: string,
    textoKey?: TextoGeradoKey,
  ): Promise<string> {
    const resp = await chamarGerador(prompt, userText, maxTokens, incluirArquivos ? state.arquivos : [])
    if (textoKey) dispatch({ type: 'SET_TEXTO_GERADO', chave: textoKey, valor: resp.text })
    dispatch({
      type: 'APPEND_BLOCO',
      titulo,
      markdown: resp.text,
      meta: { systemPrompt: prompt, userText, maxTokens, incluirArquivos },
    })
    return resp.text
  }
}
