// Modelo usado pelo Gerador de Campanhas. Enviado no request ao proxy
// /api/ai/generate — tem precedência sobre a env OPENROUTER_GENERATE_MODEL do
// backend, então não é preciso configurar env: basta editar aqui.
// Aponta para o Claude via OpenRouter para preservar os prompts calibrados.
export const MODEL_GERADOR = 'anthropic/claude-sonnet-4.5'
