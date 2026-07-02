import { Hint } from '../ui'
import { MesaEspecialistas } from '../mesa/MesaEspecialistas'
import { BlocoGerador } from '../output/BlocoGerador'
import { useGeradorState } from '../../../hooks/gerador/useGerador'
import { useGerarBloco } from '../../../hooks/gerador/useGerarBloco'
import { ctxBase } from '../../../lib/gerador/contexto'
import { CAMPOS_MESA, BLOCO_TITULOS } from '../../../lib/gerador/camposMesa'
import { PROMPT_APP_CONTEUDO, PROMPT_APP_MESA, PROMPT_APP_TEASER } from '../../../lib/gerador/prompts'

const GATE_ESTRATEGIA = 'Confirme uma direção estratégica (seção 08) para liberar este bloco.'

export function SecaoApp() {
  const state = useGeradorState()
  const gerar = useGerarBloco()
  const estrategia = state.decisoes.estrategiaEscolhida
  const argumento = state.decisoes.argumentoAppEscolhido
  const gateArg = { enabled: !!argumento, msg: 'Escolha um argumento institucional primeiro.' }
  const ctxApp = () => `${ctxBase(state)}\n\nArgumento institucional escolhido:\n${JSON.stringify(argumento)}`

  return (
    <>
      <Hint>
        A mesa institucional Boxys (Godin, Dunford, Ritson, Neumeier) decide o argumento central que
        convence o corretor a ativar esta campanha antes de escrever o conteúdo do app e o teaser.
      </Hint>
      <MesaEspecialistas
        mesa="argumentoApp"
        promptOpcoes={PROMPT_APP_MESA}
        camposOrdem={CAMPOS_MESA.argumentoApp}
        multi={false}
        maxTokens={2500}
        labelRodar="Rodar mesa institucional (App)"
        labelLoading="Rodando a mesa institucional…"
        gate={{ enabled: !!estrategia, msg: GATE_ESTRATEGIA }}
        buildContexto={() => ctxBase(state)}
      />
      <BlocoGerador
        label="Gerar conteúdo do app"
        successMsg="Conteúdo do app gerado — veja no documento abaixo."
        gate={gateArg}
        onGerar={async (progress) => {
          progress('Gerando thumb, descrição e vídeos promocional/explicativo…')
          await gerar(PROMPT_APP_CONTEUDO, ctxApp(), 8000, true, BLOCO_TITULOS.appConteudo)
        }}
      />
      <BlocoGerador
        label="Gerar teaser institucional"
        successMsg="Teaser gerado — campanha completa!"
        gate={gateArg}
        onGerar={async (progress) => {
          progress('Gerando teaser cinematográfico institucional…')
          await gerar(PROMPT_APP_TEASER, ctxApp(), 4000, false, BLOCO_TITULOS.appTeaser)
        }}
      />
    </>
  )
}
