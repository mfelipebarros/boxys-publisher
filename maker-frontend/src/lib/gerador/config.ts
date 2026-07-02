// Modelo usado pelo Gerador de Campanhas. Enviado no request ao proxy
// /api/ai/generate — tem precedência sobre a env OPENROUTER_GENERATE_MODEL do
// backend. Selecionável na UI (header) e persistido em localStorage.
// Os ids são slugs do OpenRouter — ajuste/inclua conforme o catálogo disponível.

export interface ModeloOpcao {
  id: string
  label: string
}

export const MODELOS_GERADOR: ModeloOpcao[] = [
  { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5 (recomendado)' },
  { id: 'anthropic/claude-opus-4.1', label: 'Claude Opus 4.1 (mais caro)' },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (rápido/barato)' },
  { id: 'openai/gpt-4o', label: 'GPT-4o' },
]

export const MODELO_GERADOR_PADRAO = MODELOS_GERADOR[0].id

const STORAGE_KEY = 'gerador_model'

let modeloAtual = ((): string => {
  try {
    return localStorage.getItem(STORAGE_KEY) || MODELO_GERADOR_PADRAO
  } catch {
    return MODELO_GERADOR_PADRAO
  }
})()

export function getModeloGerador(): string {
  return modeloAtual
}

export function setModeloGerador(model: string): void {
  modeloAtual = model
  try {
    localStorage.setItem(STORAGE_KEY, model)
  } catch {
    /* localStorage indisponível — mantém só em memória */
  }
}
