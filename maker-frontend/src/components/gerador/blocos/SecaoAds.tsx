import { Hint } from '../ui'
import { MesaEspecialistas } from '../mesa/MesaEspecialistas'
import { BlocoGerador } from '../output/BlocoGerador'
import { useGeradorState } from '../../../hooks/gerador/useGerador'
import { useGerarBloco } from '../../../hooks/gerador/useGerarBloco'
import { ctxBase } from '../../../lib/gerador/contexto'
import { CAMPOS_MESA, BLOCO_TITULOS } from '../../../lib/gerador/camposMesa'
import { PROMPT_ADS_GOOGLE, PROMPT_ADS_META, PROMPT_MESA_ADS_OPCOES } from '../../../lib/gerador/prompts'

const GATE_ESTRATEGIA = 'Confirme uma direção estratégica (seção 08) para liberar este bloco.'

export function SecaoAds() {
  const state = useGeradorState()
  const gerar = useGerarBloco()
  const estrategia = state.decisoes.estrategiaEscolhida
  const tom = state.decisoes.tomAdsEscolhido

  return (
    <>
      <Hint>
        A mesa de copy (Ogilvy, Halbert, Bencivenga, Sugarman, Georgi/Carlton, Bernbach, Abbott,
        Gossage) propõe tons de abordagem antes de escrever as ~40 peças completas (Meta + Google).
      </Hint>
      <MesaEspecialistas
        mesa="tomAds"
        promptOpcoes={PROMPT_MESA_ADS_OPCOES}
        camposOrdem={CAMPOS_MESA.tomAds}
        multi={false}
        maxTokens={2500}
        labelRodar="Rodar mesa de copy (Ads)"
        labelLoading="Rodando a mesa de copy…"
        gate={{ enabled: !!estrategia, msg: GATE_ESTRATEGIA }}
        buildContexto={() => ctxBase(state)}
      />
      <BlocoGerador
        label="Gerar bloco de Ads (Meta + Google)"
        successMsg="Bloco de Ads gerado, já pronto para importação — veja no documento abaixo."
        gate={{ enabled: !!tom, msg: 'Escolha um tom de copy primeiro.' }}
        onGerar={async (progress) => {
          const ctx = ctxBase(state)
          progress('Parte 1/2 — Meta Ads (12 estáticos + 4 carrosséis)…')
          await gerar(PROMPT_ADS_META, ctx, 8000, true, BLOCO_TITULOS.adsMeta, 'textoAdsMeta')
          progress('Parte 2/2 — Google Ads (Search, Display, PMax)…')
          await gerar(PROMPT_ADS_GOOGLE, ctx, 8000, false, BLOCO_TITULOS.adsGoogle, 'textoAdsGoogle')
        }}
      />
    </>
  )
}
