import { Hint } from '../ui'
import { MesaEspecialistas } from '../mesa/MesaEspecialistas'
import { BlocoGerador } from '../output/BlocoGerador'
import { useGeradorState } from '../../../hooks/gerador/useGerador'
import { useGerarBloco } from '../../../hooks/gerador/useGerarBloco'
import { ctxBase } from '../../../lib/gerador/contexto'
import { CAMPOS_MESA, BLOCO_TITULOS } from '../../../lib/gerador/camposMesa'
import { PROMPT_LP_COPY_PARTE1, PROMPT_LP_COPY_PARTE2, PROMPT_LP_UX_MESA } from '../../../lib/gerador/prompts'

const GATE_ESTRATEGIA = 'Confirme uma direção estratégica (seção 08) para liberar este bloco.'

export function SecaoLandingPage() {
  const state = useGeradorState()
  const gerar = useGerarBloco()
  const estrategia = state.decisoes.estrategiaEscolhida
  const estrutura = state.decisoes.estruturaLPEscolhida
  const parte1 = state.textosGerados.textoLPParte1
  const ctxLP = () => `${ctxBase(state)}\n\nEstrutura de UX aprovada:\n${JSON.stringify(estrutura)}`

  return (
    <>
      <Hint>
        Duas mesas em sequência: primeiro a UX (Gardner, Laja, Krug, Eyal) decide a estrutura e o
        mecanismo interativo que filtra curiosos; depois a copy é escrita em cima da estrutura aprovada.
        Gere a Parte 1 primeiro (a Parte 2 usa a Parte 1 como contexto).
      </Hint>
      <MesaEspecialistas
        mesa="estruturaLP"
        promptOpcoes={PROMPT_LP_UX_MESA}
        camposOrdem={CAMPOS_MESA.estruturaLP}
        multi={false}
        maxTokens={2500}
        labelRodar="Rodar mesa de UX (estrutura da LP)"
        labelLoading="Rodando a mesa de UX…"
        gate={{ enabled: !!estrategia, msg: GATE_ESTRATEGIA }}
        buildContexto={() => ctxBase(state)}
      />
      <BlocoGerador
        label="Gerar LP — Parte 1"
        successMsg="Parte 1 gerada — agora gere a Parte 2 para completar a LP."
        gate={{ enabled: !!estrutura, msg: 'Escolha uma estrutura de UX primeiro.' }}
        onGerar={async (progress) => {
          progress('Gerando Parte 1 (Moldura, Hero, Racional, Plantas, Localização)…')
          await gerar(PROMPT_LP_COPY_PARTE1, ctxLP(), 8000, true, BLOCO_TITULOS.lpParte1, 'textoLPParte1')
        }}
      />
      <BlocoGerador
        label="Gerar LP — Parte 2"
        successMsg="Landing Page completa gerada — veja no documento abaixo."
        gate={{ enabled: !!parte1, msg: 'Gere a Parte 1 primeiro — a Parte 2 usa ela como contexto.' }}
        onGerar={async (progress) => {
          progress('Gerando Parte 2 (Galeria, Solidez, Corretor+Agenda, FAQ, Rodapé)…')
          const ctx = `${ctxLP()}\n\nParte 1 da LP já escrita (para manter consistência de tom):\n${parte1}`
          await gerar(PROMPT_LP_COPY_PARTE2, ctx, 8000, false, BLOCO_TITULOS.lpParte2, 'textoLPParte2')
        }}
      />
    </>
  )
}
