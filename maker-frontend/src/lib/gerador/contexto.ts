// Montagem dos contextos (userText) enviados às gerações. Porta os templates
// repetidos nos handlers do protótipo (brief + estratégia + perfis).
import type { GeradorState } from '../../types/gerador'
import { buildBrief } from './brief'

const NOTA_PERFIS =
  'Perfis de público escolhidos (a campanha pode ter mais de um; se houver mais de um, decida a abordagem mais eficiente — falar com todos com um argumento comum, ou segmentar peças por perfil — e explique brevemente a escolha):'

export function ctxBriefing(state: GeradorState): string {
  return `Briefing de entrada:\n\n${buildBrief(state.formulario, state.arquivos)}`
}

// brief + perfis (usado pela mesa de estratégia, que ainda não tem estratégia).
export function ctxComPerfis(state: GeradorState): string {
  return `${ctxBriefing(state)}\n\n${NOTA_PERFIS}\n${JSON.stringify(state.decisoes.perfisPublicoEscolhidos)}`
}

// brief + estratégia + perfis (base das mesas/blocos 09-15).
export function ctxBase(state: GeradorState): string {
  const d = state.decisoes
  return `${ctxBriefing(state)}\n\nDireção estratégica escolhida:\n${JSON.stringify(d.estrategiaEscolhida)}\n\n${NOTA_PERFIS}\n${JSON.stringify(d.perfisPublicoEscolhidos)}`
}
