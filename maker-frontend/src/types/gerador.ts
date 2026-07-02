// Tipos do Gerador de Campanhas — porta o estado global do protótipo
// (gerador_campanhas.html) para um modelo React imutável.

export type TipoCampanha = 'empreendimento' | 'generica'
export type ModoPreco = 'unico' | 'tipologia'
export type ModoEstilo = 'exemplo' | 'atributos'

export interface TipologiaRow {
  nome: string
  metragem: string
  valorM2: string
}

// Espelha coletarEstadoSessao().formulario (html 2451-2485).
export interface FormularioState {
  tipoCampanha: TipoCampanha
  // Empreendimento específico
  nomeEmp: string
  incorporadora: string
  localEmp: string
  segmentoEmp: string
  estagioEmp: string
  diferenciais: string
  modoPreco: ModoPreco
  metragemEntrada: string
  valorM2Entrada: string
  tipologias: string
  tipologiaRows: TipologiaRow[]
  comissaoPct: string
  // Campanha genérica / nicho
  ganchoGen: string
  pracaGen: string
  segmentoGen: string
  estagioGen: string
  publicoGen: string
  // Comum
  corretorNome: string
  corretorEsp: string
  linksRef: string
  restricoesCampanha: string
  infoExtraCampanha: string
  // Calibrador de estilo de copy
  modoEstilo: ModoEstilo
  exemplosCopy: string
  atrFormalidade: string
  atrComprimento: string
  atrCta: string
  atrDados: string
  atrRitmo: string
  atrOutras: string
  perfilEstiloTexto: string
  // Ângulos (Set no protótipo → array imutável aqui)
  angulos: string[]
}

// Arquivo de referência: já lido em base64 (o protótipo lia sob demanda do File).
export interface ArquivoRef {
  name: string
  size: number
  mediaType: string // 'application/pdf' | 'image/png' | ...
  base64: string // conteúdo sem o prefixo "data:...;base64,"
}

// Opção proposta por uma mesa (o `titulo` sempre existe; os demais campos variam).
export interface Opcao {
  titulo: string
  [campo: string]: string
}

export interface BlocoMeta {
  systemPrompt: string
  userText: string
  maxTokens: number
  incluirArquivos: boolean
}

export interface Bloco {
  titulo: string
  markdown: string
  meta: BlocoMeta
}

export interface Decisoes {
  perfisPublicoEscolhidos: Opcao[]
  estrategiaEscolhida: Opcao | null
  tomAdsEscolhido: Opcao | null
  castingVideoEscolhidos: Opcao[]
  abordagemOrganicoEscolhida: Opcao | null
  estruturaLPEscolhida: Opcao | null
  argumentoAppEscolhido: Opcao | null
  estruturaTrafegoEscolhida: Opcao | null
}

export interface TextosGerados {
  textoAdsMeta: string
  textoAdsGoogle: string
  textoVideosTemplates: string
  textoVideosCine: string
  textoLPParte1: string
  textoLPParte2: string
}

export interface GeradorState {
  formulario: FormularioState
  arquivos: ArquivoRef[]
  decisoes: Decisoes
  textosGerados: TextosGerados
  blocosRegistro: Bloco[]
  ultimasOpcoesPorMesa: Record<string, Opcao[]>
  tituloCampanha: string
  outputCompleto: string
}

// Sessão persistida em .json (coletarEstadoSessao, html 2441-2497).
export interface SessaoGerador {
  versaoGerador: number
  salvoEm: string
  formulario: FormularioState
  arquivos: ArquivoRef[]
  decisoes: Decisoes
  textosGerados: TextosGerados
  blocosRegistro: Bloco[]
  tituloCampanha: string
  outputCompleto: string
}
