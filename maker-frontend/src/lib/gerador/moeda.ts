// Porta VERBATIM das funções de moeda/metragem (html 1166-1199).

export function parseMoeda(valor: string): number | null {
  if (!valor) return null
  const limpo = valor
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(,|$))/g, '')
    .replace(',', '.')
  const num = parseFloat(limpo)
  return isNaN(num) ? null : num
}

export function formatMoeda(num: number): string {
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function parseMetragem(txt: string): number | null {
  if (!txt) return null
  const match = txt.replace(',', '.').match(/[\d.]+/)
  if (!match) return null
  const num = parseFloat(match[0])
  return isNaN(num) ? null : num
}
