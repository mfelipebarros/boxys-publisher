// Ordenação de campos exibidos nos cards de cada mesa (porta os camposOrdem de
// renderOpcoes). Labels verbatim do protótipo (1621, 1712, 1772, 1845, 1924, 2014, 2106).
import type { MesaId } from '../../hooks/gerador/geradorReducer'

export const CAMPOS_MESA: Record<MesaId, [string, string][]> = {
  perfilPublico: [
    ['perfil_demografico', 'Perfil: '],
    ['job_to_be_done', 'Job-to-be-done: '],
    ['codigo_emocional', 'Código emocional: '],
    ['comportamento_de_midia', 'Mídia: '],
    ['trade_off', 'Trade-off: '],
  ],
  estrategia: [
    ['tese_central', 'Tese: '],
    ['estagio_consciencia', 'Estágio: '],
    ['angulo_dominante', 'Ângulo: '],
    ['trade_off', 'Trade-off: '],
  ],
  tomAds: [
    ['tom', 'Tom: '],
    ['exemplo_headline', 'Exemplo: '],
    ['trade_off', 'Trade-off: '],
  ],
  castingVideo: [
    ['perfil', 'Perfil: '],
    ['referencia_identificacao', 'Identificação: '],
    ['trade_off', 'Trade-off: '],
  ],
  abordagemOrganico: [
    ['tom_visual', 'Tom visual: '],
    ['mix_personalizacao', 'Mix de personalização: '],
    ['trade_off', 'Trade-off: '],
  ],
  estruturaLP: [
    ['mecanismo_interativo', 'Mecanismo interativo: '],
    ['enfase_estrutural', 'Ênfase estrutural: '],
    ['trade_off', 'Trade-off: '],
  ],
  argumentoApp: [
    ['argumento_central', 'Argumento: '],
    ['prova_de_valor', 'Prova de valor: '],
    ['trade_off', 'Trade-off: '],
  ],
  estruturaTrafego: [
    ['logica_de_publico', 'Público: '],
    ['estrutura_de_campanha', 'Estrutura: '],
    ['trade_off', 'Trade-off: '],
  ],
}

// Títulos canônicos dos blocos gerados — VERBATIM do appendToOutput (html 1805-2165).
// Usados em APPEND_BLOCO, no gate do Tráfego e na serialização de sessão.
export const BLOCO_TITULOS = {
  adsMeta: 'Bloco: Ads — Meta (formato de importação)',
  adsGoogle: 'Bloco: Ads — Google (formato de importação)',
  videosTemplates: 'Bloco: Vídeos — Templates de anúncio',
  videosCine: 'Bloco: Vídeos — Captação cinematográfica',
  organicoCarrosseis: 'Bloco: Redes Sociais — Carrosséis',
  organicoEstaticos: 'Bloco: Redes Sociais — Estáticos e Status',
  lpParte1: 'Bloco: Landing Page — Parte 1',
  lpParte2: 'Bloco: Landing Page — Parte 2',
  appConteudo: 'Bloco: App — Thumb, Descrição e Vídeos',
  appTeaser: 'Bloco: App — Teaser Cinematográfico',
  trafegoPrincipal: 'Bloco: Tráfego Pago — Meta Ads + Google Ads',
  trafegoSecundario: 'Bloco: Tráfego Pago — TikTok, LinkedIn, Pinterest e X',
  sintese: 'Síntese das Estratégias Utilizadas',
} as const
