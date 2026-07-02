// Reducer do Gerador de Campanhas. Porta o estado global do protótipo
// (vars soltas + window.blocosRegistro) para um reducer imutável.
import type {
  ArquivoRef,
  Bloco,
  BlocoMeta,
  Decisoes,
  FormularioState,
  GeradorState,
  Opcao,
  SessaoGerador,
} from '../../types/gerador'

// Mesas que geram opções. Multi = seleção múltipla (perfil de público, casting).
export type MesaId =
  | 'perfilPublico'
  | 'estrategia'
  | 'tomAds'
  | 'castingVideo'
  | 'abordagemOrganico'
  | 'estruturaLP'
  | 'argumentoApp'
  | 'estruturaTrafego'

export const MESAS_MULTI: MesaId[] = ['perfilPublico', 'castingVideo']

export type TextoGeradoKey = keyof GeradorState['textosGerados']

const FORMULARIO_INICIAL: FormularioState = {
  tipoCampanha: 'empreendimento',
  nomeEmp: '',
  incorporadora: '',
  localEmp: '',
  segmentoEmp: 'Alto padrão',
  estagioEmp: 'Lançamento',
  diferenciais: '',
  modoPreco: 'unico',
  metragemEntrada: '',
  valorM2Entrada: '',
  tipologias: '',
  tipologiaRows: [{ nome: '', metragem: '', valorM2: '' }],
  comissaoPct: '',
  ganchoGen: '',
  pracaGen: '',
  segmentoGen: 'Médio padrão',
  estagioGen: 'Lançamento',
  publicoGen: '',
  corretorNome: '{CORRETOR_NOME}',
  corretorEsp: '',
  linksRef: '',
  restricoesCampanha: '',
  infoExtraCampanha: '',
  modoEstilo: 'exemplo',
  exemplosCopy: '',
  atrFormalidade: 'Informal',
  atrComprimento: 'Médias, equilibradas',
  atrCta: 'Direto',
  atrDados: 'Médio',
  atrRitmo: 'Fluido — frases conectadas, cadência',
  atrOutras: '',
  perfilEstiloTexto: '',
  angulos: [],
}

const DECISOES_INICIAL: Decisoes = {
  perfisPublicoEscolhidos: [],
  estrategiaEscolhida: null,
  tomAdsEscolhido: null,
  castingVideoEscolhidos: [],
  abordagemOrganicoEscolhida: null,
  estruturaLPEscolhida: null,
  argumentoAppEscolhido: null,
  estruturaTrafegoEscolhida: null,
}

export const INITIAL_STATE: GeradorState = {
  formulario: FORMULARIO_INICIAL,
  arquivos: [],
  decisoes: DECISOES_INICIAL,
  textosGerados: {
    textoAdsMeta: '',
    textoAdsGoogle: '',
    textoVideosTemplates: '',
    textoVideosCine: '',
    textoLPParte1: '',
    textoLPParte2: '',
  },
  blocosRegistro: [],
  ultimasOpcoesPorMesa: {},
  tituloCampanha: '',
  outputCompleto: '',
}

export type GeradorAction =
  | { type: 'SET_CAMPO'; campo: keyof FormularioState; valor: FormularioState[keyof FormularioState] }
  | { type: 'TOGGLE_ANGULO'; angulo: string }
  | { type: 'SET_ARQUIVOS'; arquivos: ArquivoRef[] }
  | { type: 'SET_OPCOES_MESA'; mesa: MesaId; opcoes: Opcao[] }
  | { type: 'CONFIRMAR_MESA'; mesa: MesaId; selecao: Opcao[] }
  | { type: 'APPEND_BLOCO'; titulo: string; markdown: string; meta: BlocoMeta }
  | { type: 'SET_TEXTO_GERADO'; chave: TextoGeradoKey; valor: string }
  | { type: 'RESTAURAR_SESSAO'; sessao: SessaoGerador }
  | { type: 'RESET' }

// Mapeia uma mesa → campo de decisão. Multi guarda array; single guarda [0]|null.
const MESA_DECISAO: Record<MesaId, keyof Decisoes> = {
  perfilPublico: 'perfisPublicoEscolhidos',
  estrategia: 'estrategiaEscolhida',
  tomAds: 'tomAdsEscolhido',
  castingVideo: 'castingVideoEscolhidos',
  abordagemOrganico: 'abordagemOrganicoEscolhida',
  estruturaLP: 'estruturaLPEscolhida',
  argumentoApp: 'argumentoAppEscolhido',
  estruturaTrafego: 'estruturaTrafegoEscolhida',
}

// Lê a decisão de uma mesa sempre como array (single vira [] ou [opcao]).
export function getSelecaoMesa(decisoes: Decisoes, mesa: MesaId): Opcao[] {
  const v = decisoes[MESA_DECISAO[mesa]]
  if (Array.isArray(v)) return v
  return v ? [v] : []
}

// Porta rebuildOutput (html 1523-1531): recompõe outputCompleto e tituloCampanha.
function rebuild(state: GeradorState): GeradorState {
  const outputCompleto = state.blocosRegistro
    .map((b) => `\n\n# ${b.titulo}\n\n${b.markdown}`)
    .join('')
  const f = state.formulario
  const tituloCampanha = f.nomeEmp || f.ganchoGen || 'campanha-boxys'
  return { ...state, outputCompleto, tituloCampanha }
}

export function geradorReducer(state: GeradorState, action: GeradorAction): GeradorState {
  switch (action.type) {
    case 'SET_CAMPO':
      return { ...state, formulario: { ...state.formulario, [action.campo]: action.valor } }

    case 'TOGGLE_ANGULO': {
      const has = state.formulario.angulos.includes(action.angulo)
      const angulos = has
        ? state.formulario.angulos.filter((a) => a !== action.angulo)
        : [...state.formulario.angulos, action.angulo]
      return { ...state, formulario: { ...state.formulario, angulos } }
    }

    case 'SET_ARQUIVOS':
      return { ...state, arquivos: action.arquivos }

    case 'SET_OPCOES_MESA':
      return {
        ...state,
        ultimasOpcoesPorMesa: { ...state.ultimasOpcoesPorMesa, [action.mesa]: action.opcoes },
      }

    case 'CONFIRMAR_MESA': {
      const campo = MESA_DECISAO[action.mesa]
      const valor: Opcao[] | Opcao | null = MESAS_MULTI.includes(action.mesa)
        ? action.selecao
        : action.selecao[0] ?? null
      return { ...state, decisoes: { ...state.decisoes, [campo]: valor } }
    }

    case 'APPEND_BLOCO': {
      const idx = state.blocosRegistro.findIndex((b) => b.titulo === action.titulo)
      const novo: Bloco = { titulo: action.titulo, markdown: action.markdown, meta: action.meta }
      const blocosRegistro =
        idx >= 0
          ? state.blocosRegistro.map((b, i) => (i === idx ? novo : b))
          : [...state.blocosRegistro, novo]
      return rebuild({ ...state, blocosRegistro })
    }

    case 'SET_TEXTO_GERADO':
      return {
        ...state,
        textosGerados: { ...state.textosGerados, [action.chave]: action.valor },
      }

    case 'RESTAURAR_SESSAO': {
      const s = action.sessao
      const restored: GeradorState = {
        ...INITIAL_STATE,
        formulario: { ...FORMULARIO_INICIAL, ...s.formulario },
        arquivos: s.arquivos ?? [],
        decisoes: { ...DECISOES_INICIAL, ...s.decisoes },
        textosGerados: { ...INITIAL_STATE.textosGerados, ...s.textosGerados },
        blocosRegistro: s.blocosRegistro ?? [],
        tituloCampanha: s.tituloCampanha ?? '',
        outputCompleto: s.outputCompleto ?? '',
      }
      // Recompõe outputCompleto se a sessão trouxe blocos mas não o texto (fallback).
      return restored.blocosRegistro.length && !restored.outputCompleto
        ? rebuild(restored)
        : restored
    }

    case 'RESET':
      return INITIAL_STATE

    default:
      return state
  }
}
