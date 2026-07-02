// Montagem do briefing — adaptação de buildBrief/gerarCodigoCampanha (html 1299-1398).
// A LÓGICA é copiada 1:1; só troca a fonte dos valores (DOM → FormularioState).
import type { ArquivoRef, FormularioState } from '../../types/gerador'
import { formatMoeda, parseMetragem, parseMoeda } from './moeda'

export function gerarCodigoCampanha(nome: string): string {
  const clean = (nome || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
  if (!clean) return 'CAMP'
  const words = clean.split(/\s+/).filter(Boolean)
  let code: string
  if (words.length === 1) {
    code = words[0].substring(0, 6).toUpperCase()
  } else {
    code = words.map((w) => w[0]).join('').toUpperCase()
    if (code.length < 4) {
      code = (code + words[0].substring(1)).substring(0, 6).toUpperCase()
    }
  }
  return code.substring(0, 8) || 'CAMP'
}

// Porta coletarTipologiasComComissao (html 1201-1227), lendo de tipologiaRows.
function coletarTipologiasComComissao(f: FormularioState): string[] {
  const pct = parseFloat(f.comissaoPct) || null
  return f.tipologiaRows
    .map((row) => {
      const nome = row.nome
      const metragemTxt = row.metragem
      const valorM2Txt = row.valorM2
      const metragemNum = parseMetragem(metragemTxt)
      const valorM2Num = parseMoeda(valorM2Txt)

      let precoCalculado: number | null = null
      let precoTxt = 'não informado (preencha metragem e valor do m²)'
      if (metragemNum && valorM2Num) {
        precoCalculado = metragemNum * valorM2Num
        precoTxt = formatMoeda(precoCalculado)
      }

      let comissaoTxt = ''
      if (pct && precoCalculado) {
        comissaoTxt = ` — Comissão (${pct}%): ${formatMoeda((precoCalculado * pct) / 100)}`
      }

      return nome || metragemTxt || valorM2Txt
        ? `${nome || 'Tipologia'} ${metragemTxt ? '(' + metragemTxt + ')' : ''} — Valor do m²: ${valorM2Txt || 'não informado'} — Preço calculado: ${precoTxt}${comissaoTxt}`.trim()
        : null
    })
    .filter((l): l is string => Boolean(l))
}

export function buildBrief(f: FormularioState, arquivos: ArquivoRef[] = []): string {
  const tipo = f.tipoCampanha
  const corretorNome = f.corretorNome || '{CORRETOR_NOME}'
  const corretorEsp = f.corretorEsp || 'não informado'

  const partes: string[] = []
  let nomeBase = ''
  if (tipo === 'empreendimento') {
    nomeBase = f.nomeEmp
    partes.push(`TIPO: Empreendimento específico`)
    partes.push(`Nome do empreendimento: ${f.nomeEmp || 'não informado'}`)
    partes.push(`Incorporadora/Construtora: ${f.incorporadora || 'não informado'}`)
    partes.push(`Bairro/Cidade: ${f.localEmp || 'não informado'}`)
    partes.push(`Segmento: ${f.segmentoEmp}`)
    partes.push(`Estágio do empreendimento: ${f.estagioEmp}`)

    const modoPreco = f.modoPreco
    const pct = parseFloat(f.comissaoPct) || null
    if (modoPreco === 'unico') {
      const metragemTxt = f.metragemEntrada
      const valorM2Txt = f.valorM2Entrada
      const metragemNum = parseMetragem(metragemTxt)
      const valorM2Num = parseMoeda(valorM2Txt)
      let precoNum: number | null = null
      let precoTxt = 'não informado (preencha metragem e valor do m²)'
      if (metragemNum && valorM2Num) {
        precoNum = metragemNum * valorM2Num
        precoTxt = formatMoeda(precoNum)
      }
      partes.push(`Tipologias e metragens: ${f.tipologias || 'não informado'}`)
      partes.push(`Metragem de entrada: ${metragemTxt || 'não informado'} — Valor do m²: ${valorM2Txt || 'não informado'}`)
      partes.push(`Preço de entrada/referência (calculado): ${precoTxt}`)
      if (pct) {
        if (precoNum) {
          partes.push(`Comissionamento do corretor: ${pct}% — Valor final sobre o preço de entrada: ${formatMoeda((precoNum * pct) / 100)}`)
        } else {
          partes.push(`Comissionamento do corretor: ${pct}% (não foi possível calcular valor final — preencha metragem e valor do m²)`)
        }
      }
    } else {
      const linhas = coletarTipologiasComComissao(f)
      partes.push(`Preço por tipologia (com comissão calculada quando aplicável):\n${linhas.length ? linhas.map((l) => '- ' + l).join('\n') : 'não informado'}`)
      if (pct) partes.push(`Comissionamento do corretor: ${pct}% sobre cada tipologia (valores já calculados acima)`)
    }
    partes.push(`Diferenciais: ${f.diferenciais || 'não informado'}`)
  } else {
    nomeBase = f.ganchoGen
    partes.push(`TIPO: Campanha genérica / nicho`)
    partes.push(`Gancho principal: ${f.ganchoGen || 'não informado'}`)
    partes.push(`Praça/região: ${f.pracaGen || 'não informado'}`)
    partes.push(`Segmento: ${f.segmentoGen}`)
    partes.push(`Estágio do empreendimento: ${f.estagioGen}`)
    partes.push(`Perfil de renda/público: ${f.publicoGen || 'não informado'}`)
  }
  partes.push(`Corretor: ${corretorNome} — ${corretorEsp}`)

  const codigoCampanha = gerarCodigoCampanha(nomeBase)
  partes.push(`Código da campanha para IDs (usar em TODOS os IDs de peça): ${codigoCampanha}`)

  const angulos = f.angulos
  partes.push(`Ângulos de campanha selecionados: ${angulos.length ? angulos.join(', ') : 'nenhum selecionado — escolha os ângulos mais coerentes com o briefing acima'}`)

  const links = f.linksRef
  if (links) partes.push(`Links e observações de referência: ${links}`)
  if (arquivos.length) partes.push(`Materiais anexados nesta mensagem: ${arquivos.map((a) => a.name).join(', ')} — use como fonte real de dados do empreendimento (texto, imagens, plantas, book).`)

  const restricoes = f.restricoesCampanha
  if (restricoes) partes.push(`RESTRIÇÕES DA CAMPANHA (regras negativas — NUNCA violar em nenhuma peça, de nenhum bloco): ${restricoes}`)

  const infoExtra = f.infoExtraCampanha
  if (infoExtra) partes.push(`Informações extras a considerar: ${infoExtra}`)

  const estiloCopy = f.perfilEstiloTexto
  if (estiloCopy) partes.push(`CALIBRAÇÃO DE ESTILO DE COPY (aplicar em toda copy escrita, coexistindo com o tom escolhido em cada mesa):\n${estiloCopy}`)

  return partes.join('\n')
}

// Porta mdToHtml (html 1393-1399): markdown básico → HTML.
export function mdToHtml(md: string): string {
  return md
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
}
