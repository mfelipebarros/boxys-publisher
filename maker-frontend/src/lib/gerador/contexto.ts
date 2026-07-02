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

// Porta resumir (html 2176-2179): corta textos longos para a deliberação da mesa.
function resumir(texto: string, limite: number): string {
  if (!texto) return ''
  return texto.length > limite
    ? texto.slice(0, limite) + '\n[...trecho reduzido para a deliberação; a versão completa é usada na geração final...]'
    : texto
}

// Porta contextoCompletoParaTrafego (html 2181-2209). Gate composto: Ads + Vídeos + UX da LP.
export function ctxTrafego(state: GeradorState, resumido: boolean): { erro: string } | { contexto: string } {
  const d = state.decisoes
  const t = state.textosGerados
  if (!t.textoAdsMeta || !t.textoAdsGoogle)
    return { erro: 'O bloco de Ads (Meta + Google) precisa estar gerado antes do Tráfego Pago, para a segmentação usar os mesmos ângulos já escritos nos anúncios.' }
  if (!t.textoVideosTemplates || !t.textoVideosCine)
    return { erro: 'O bloco de Vídeos precisa estar gerado antes do Tráfego Pago — os vídeos são anúncios e a segmentação/formatos recomendados por plataforma (Reels, Stories, TikTok, etc.) precisam considerá-los.' }
  if (!d.estruturaLPEscolhida)
    return { erro: 'A mesa de UX da Landing Page precisa ter sido rodada (pelo menos a escolha de estrutura) antes do Tráfego Pago, para o evento de otimização bater com o mecanismo real de conversão da LP.' }

  const limite = resumido ? 1200 : Infinity
  const s = resumido ? ' — resumo' : ''
  const contexto =
    `Briefing de entrada:\n\n${buildBrief(state.formulario, state.arquivos)}\n\n` +
    `Direção estratégica: ${JSON.stringify(d.estrategiaEscolhida)}\n\n${NOTA_PERFIS}\n${JSON.stringify(d.perfisPublicoEscolhidos)}\n\n` +
    `Ads — Meta já escritos (use os mesmos ângulos para a segmentação)${s}:\n${resumir(t.textoAdsMeta, limite)}\n\n` +
    `Ads — Google já escritos (use as mesmas intenções de busca para as palavras-chave/públicos)${s}:\n${resumir(t.textoAdsGoogle, limite)}\n\n` +
    `Vídeos — Templates de anúncio já escritos (use os ângulos e ganchos para casar formato/objetivo de campanha por plataforma)${s}:\n${resumir(t.textoVideosTemplates, limite)}\n\n` +
    `Vídeos — Captação cinematográfica já escritos (personagem/arquétipo usado nos criativos)${s}:\n${resumir(t.textoVideosCine, limite)}\n\n` +
    `Estrutura de UX da Landing Page aprovada (use para definir o evento de otimização):\n${JSON.stringify(d.estruturaLPEscolhida)}\n\n` +
    `Tom de copy (Ads): ${d.tomAdsEscolhido ? JSON.stringify(d.tomAdsEscolhido) : 'não definido ainda'}\n\n` +
    `Casting de personagem (Vídeos): ${d.castingVideoEscolhidos.length ? JSON.stringify(d.castingVideoEscolhidos) : 'não definido ainda'}\n\n` +
    `Abordagem orgânica (Redes Sociais): ${d.abordagemOrganicoEscolhida ? JSON.stringify(d.abordagemOrganicoEscolhida) : 'não definido ainda'}\n\n` +
    `Argumento institucional (App): ${d.argumentoAppEscolhido ? JSON.stringify(d.argumentoAppEscolhido) : 'não definido ainda'}`
  return { contexto }
}

// Porta o contexto da Síntese (html 2304-2315): todas as decisões, com "não definido ainda".
export function ctxSintese(state: GeradorState): string {
  const d = state.decisoes
  return (
    `Briefing de entrada:\n\n${buildBrief(state.formulario, state.arquivos)}\n\n` +
    `Direção estratégica: ${JSON.stringify(d.estrategiaEscolhida)}\n\n${NOTA_PERFIS}\n${JSON.stringify(d.perfisPublicoEscolhidos)}\n\n` +
    `Tom de copy (Ads): ${d.tomAdsEscolhido ? JSON.stringify(d.tomAdsEscolhido) : 'não definido ainda'}\n\n` +
    `Casting de personagem (Vídeos): ${d.castingVideoEscolhidos.length ? JSON.stringify(d.castingVideoEscolhidos) : 'não definido ainda'}\n\n` +
    `Abordagem orgânica (Redes Sociais): ${d.abordagemOrganicoEscolhida ? JSON.stringify(d.abordagemOrganicoEscolhida) : 'não definido ainda'}\n\n` +
    `Estrutura de UX (Landing Page): ${d.estruturaLPEscolhida ? JSON.stringify(d.estruturaLPEscolhida) : 'não definido ainda'}\n\n` +
    `Argumento institucional (App): ${d.argumentoAppEscolhido ? JSON.stringify(d.argumentoAppEscolhido) : 'não definido ainda'}\n\n` +
    `Estrutura de tráfego pago: ${d.estruturaTrafegoEscolhida ? JSON.stringify(d.estruturaTrafegoEscolhida) : 'não definido ainda'}`
  )
}
