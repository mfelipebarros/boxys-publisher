// Ordenação de campos exibidos nos cards de cada mesa (porta os camposOrdem de
// renderOpcoes). Labels de perfil/estratégia são verbatim do protótipo (1621, 1712).
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
    ['exemplo_headline', 'Ex. headline: '],
    ['trade_off', 'Trade-off: '],
  ],
  castingVideo: [
    ['perfil', 'Perfil: '],
    ['referencia_identificacao', 'Identificação: '],
    ['trade_off', 'Trade-off: '],
  ],
  abordagemOrganico: [
    ['tom_visual', 'Visual: '],
    ['mix_personalizacao', 'Mix: '],
    ['trade_off', 'Trade-off: '],
  ],
  estruturaLP: [
    ['mecanismo_interativo', 'Mecanismo: '],
    ['enfase_estrutural', 'Ênfase: '],
    ['trade_off', 'Trade-off: '],
  ],
  argumentoApp: [
    ['argumento_central', 'Argumento: '],
    ['prova_de_valor', 'Prova: '],
    ['trade_off', 'Trade-off: '],
  ],
  estruturaTrafego: [
    ['logica_de_publico', 'Público: '],
    ['estrutura_de_campanha', 'Estrutura: '],
    ['trade_off', 'Trade-off: '],
  ],
}

// Títulos canônicos dos blocos gerados (usados em APPEND_BLOCO, no gate do Tráfego
// e na serialização de sessão). Precisam bater com os títulos reais do appendToOutput.
export const BLOCO_TITULOS = {
  adsMeta: 'Ads — Meta',
  adsGoogle: 'Ads — Google',
  videosTemplates: 'Vídeos — Templates de Anúncio',
  videosCine: 'Vídeos — Cinematográficos',
  organicoCarrosseis: 'Redes Sociais — Carrosséis',
  organicoEstaticos: 'Redes Sociais — Estáticos e Status',
  lpParte1: 'Landing Page — Parte 1',
  lpParte2: 'Landing Page — Parte 2',
  appConteudo: 'App — Conteúdo',
  appTeaser: 'App — Teaser',
  trafegoPrincipal: 'Tráfego Pago — Meta e Google',
  trafegoSecundario: 'Tráfego Pago — TikTok, LinkedIn, Pinterest e X',
  sintese: 'Síntese das Estratégias',
} as const
