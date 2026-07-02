// Porta VERBATIM de sanitizeJsonStrings + parseJsonSeguro (html 1440-1488).
// Corrige os dois problemas mais comuns quando um LLM escreve "JSON" como texto livre.

export function sanitizeJsonStrings(str: string): string {
  // 1) quebras de linha reais dentro de um valor de string (não escapadas como \n)
  // 2) aspas duplas soltas DENTRO do próprio texto (ex: mencionar uma palavra "entre aspas"),
  //    que fecham a string antes da hora e quebram o restante do parsing.
  // Heurística para (2): ao encontrar uma aspa dentro de uma string, olha o próximo caractere
  // não-espaço. Se for , } ] : (ou fim do texto), é o fechamento real da string.
  // Caso contrário, é uma aspa de conteúdo — é escapada e a leitura continua dentro da string.
  let result = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    if (!inString) {
      if (ch === '"') {
        inString = true
        result += ch
      } else {
        result += ch
      }
      continue
    }
    if (escaped) {
      result += ch
      escaped = false
      continue
    }
    if (ch === '\\') {
      result += ch
      escaped = true
      continue
    }
    if (ch === '\n') {
      result += '\\n'
      continue
    }
    if (ch === '\r') {
      continue
    }
    if (ch === '\t') {
      result += '\\t'
      continue
    }
    if (ch === '"') {
      let j = i + 1
      while (j < str.length && /\s/.test(str[j])) j++
      const next = str[j]
      const isRealEnd = next === ',' || next === '}' || next === ']' || next === ':' || j >= str.length
      if (isRealEnd) {
        inString = false
        result += ch
      } else {
        result += '\\"'
      }
      continue
    }
    result += ch
  }
  return result
}

export function parseJsonSeguro<T = unknown>(text: string): T {
  let limpo = text.replace(/```json|```/g, '').trim()
  const start = limpo.indexOf('{')
  const end = limpo.lastIndexOf('}')
  if (start >= 0 && end > start) limpo = limpo.substring(start, end + 1)
  limpo = sanitizeJsonStrings(limpo)
  return JSON.parse(limpo) as T
}
