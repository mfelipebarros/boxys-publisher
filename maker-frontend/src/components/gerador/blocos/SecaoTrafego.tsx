import { Hint } from '../ui'
import { MesaEspecialistas } from '../mesa/MesaEspecialistas'
import { BlocoGerador } from '../output/BlocoGerador'
import { useGeradorState } from '../../../hooks/gerador/useGerador'
import { useGerarBloco } from '../../../hooks/gerador/useGerarBloco'
import { ctxTrafego } from '../../../lib/gerador/contexto'
import { CAMPOS_MESA, BLOCO_TITULOS } from '../../../lib/gerador/camposMesa'
import { PROMPT_TRAFEGO_MESA, PROMPT_TRAFEGO_PRINCIPAL, PROMPT_TRAFEGO_SECUNDARIO } from '../../../lib/gerador/prompts'

export function SecaoTrafego() {
  const state = useGeradorState()
  const gerar = useGerarBloco()
  const estruturaTrafego = state.decisoes.estruturaTrafegoEscolhida

  const preReq = ctxTrafego(state, true)
  const gateMesa =
    'erro' in preReq ? { enabled: false, msg: preReq.erro } : { enabled: true, msg: '' }
  const gateGeracao = { enabled: !!estruturaTrafego, msg: 'Escolha uma estrutura de tráfego pago primeiro.' }

  function ctxGeracao(): string {
    const r = ctxTrafego(state, false)
    const base = 'contexto' in r ? r.contexto : ''
    return `${base}\n\nEstrutura de tráfego pago aprovada:\n${JSON.stringify(estruturaTrafego)}`
  }

  return (
    <>
      <Hint>
        Requer que os blocos de Ads e Vídeos já tenham sido rodados, além da mesa de UX da Landing Page —
        a segmentação usa os mesmos ângulos dos anúncios e o evento de otimização usa o mecanismo real da
        LP. A mesa (Perry Marshall, Molly Pittman, Ralph Burns) decide a estrutura antes de gerar as
        configurações completas.
      </Hint>
      <MesaEspecialistas
        mesa="estruturaTrafego"
        promptOpcoes={PROMPT_TRAFEGO_MESA}
        camposOrdem={CAMPOS_MESA.estruturaTrafego}
        multi={false}
        maxTokens={3500}
        labelRodar="Rodar mesa de tráfego pago"
        labelLoading="Rodando a mesa de tráfego pago…"
        gate={gateMesa}
        buildContexto={() => {
          const r = ctxTrafego(state, true)
          return 'contexto' in r ? r.contexto : ''
        }}
      />
      <BlocoGerador
        label="Gerar config Meta + Google"
        successMsg="Configuração de Meta + Google gerada — veja no documento abaixo."
        gate={gateGeracao}
        onGerar={async (progress) => {
          progress('Gerando configuração de Meta Ads + Google Ads…')
          await gerar(PROMPT_TRAFEGO_PRINCIPAL, ctxGeracao(), 8000, false, BLOCO_TITULOS.trafegoPrincipal)
        }}
      />
      <BlocoGerador
        label="Gerar config TikTok, LinkedIn, Pinterest e X"
        successMsg="Configuração das plataformas secundárias gerada — veja no documento abaixo."
        gate={gateGeracao}
        onGerar={async (progress) => {
          progress('Gerando configuração de TikTok, LinkedIn, Pinterest e X…')
          await gerar(PROMPT_TRAFEGO_SECUNDARIO, ctxGeracao(), 8000, false, BLOCO_TITULOS.trafegoSecundario)
        }}
      />
    </>
  )
}
