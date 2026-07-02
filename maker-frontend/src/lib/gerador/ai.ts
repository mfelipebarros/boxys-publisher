// Chamadas de IA do gerador — adapta chamarClaude/chamarClaudeJSON/montarContentBlocks
// (html 1402-1507). O fetch direto à Anthropic vira api.post ao proxy /api/ai/generate;
// o retry-JSON e a sanitização permanecem NO CLIENTE (heurística calibrada).
import { api } from '../api'
import type { ArquivoRef } from '../../types/gerador'
import { parseJsonSeguro } from './parseJson'
import { getModeloGerador } from './config'

interface ContentBlock {
  type: 'text' | 'image' | 'document'
  text?: string
  source?: { type: 'base64'; media_type: string; data: string }
  name?: string
}

interface AiGenerateResponse {
  status: string
  text: string
  stop_reason: string | null
}

export interface GeracaoResultado {
  text: string
  stopReason: string | null
}

// Porta montarContentBlocks (html 1402-1415): os arquivos já vêm em base64.
function montarContentBlocks(textoPrincipal: string, arquivos: ArquivoRef[]): ContentBlock[] {
  const blocks: ContentBlock[] = [{ type: 'text', text: textoPrincipal }]
  for (const a of arquivos) {
    if (a.mediaType === 'application/pdf') {
      blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.base64 }, name: a.name })
    } else if (a.mediaType.startsWith('image/')) {
      blocks.push({ type: 'image', source: { type: 'base64', media_type: a.mediaType, data: a.base64 }, name: a.name })
    }
  }
  return blocks
}

// Porta chamarClaude (html 1417-1438) → chamada ao proxy.
export async function chamarGerador(
  systemPrompt: string,
  userText: string,
  maxTokens: number,
  arquivos: ArquivoRef[] = [],
): Promise<GeracaoResultado> {
  const data = await api.post<AiGenerateResponse>('/api/ai/generate', {
    system: systemPrompt,
    content: montarContentBlocks(userText, arquivos),
    max_tokens: maxTokens,
    model: getModeloGerador(),
  })
  const text = data.text || ''
  if (!text) throw new Error('Resposta vazia da API (stop_reason: ' + (data.stop_reason || 'desconhecido') + ').')
  return { text, stopReason: data.stop_reason }
}

// Porta chamarClaudeJSON (html 1493-1507): retry com mais tokens quando o JSON
// vem cortado/malformado ou a chamada falha. Mantido intacto no cliente.
export async function chamarGeradorJSON<T = unknown>(
  systemPrompt: string,
  userText: string,
  maxTokens: number,
): Promise<T> {
  try {
    const primeira = await chamarGerador(systemPrompt, userText, maxTokens)
    if (primeira.stopReason === 'max_tokens') throw new Error('cortado por limite de tokens')
    return parseJsonSeguro<T>(primeira.text)
  } catch (e) {
    const maxTokensRetry = Math.min(maxTokens * 2, 8000)
    const msg = e instanceof Error ? e.message : String(e)
    try {
      const segunda = await chamarGerador(
        systemPrompt,
        userText + '\n\nIMPORTANTE: a tentativa anterior falhou (' + msg + '). Responda de novo, mais conciso em cada campo, garantindo JSON 100% válido.',
        maxTokensRetry,
      )
      return parseJsonSeguro<T>(segunda.text)
    } catch (e2) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2)
      throw new Error(`Falhou mesmo após tentar de novo. Primeiro erro: ${msg} | Segundo erro: ${msg2}`)
    }
  }
}
