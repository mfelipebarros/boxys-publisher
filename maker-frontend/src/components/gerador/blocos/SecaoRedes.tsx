import { Hint } from '../ui'
import { MesaEspecialistas } from '../mesa/MesaEspecialistas'
import { BlocoGerador } from '../output/BlocoGerador'
import { useGeradorState } from '../../../hooks/gerador/useGerador'
import { useGerarBloco } from '../../../hooks/gerador/useGerarBloco'
import { ctxBase } from '../../../lib/gerador/contexto'
import { CAMPOS_MESA, BLOCO_TITULOS } from '../../../lib/gerador/camposMesa'
import { PROMPT_ORGANICO_CARROSSEIS, PROMPT_ORGANICO_ESTATICOS, PROMPT_ORGANICO_MESA } from '../../../lib/gerador/prompts'

const GATE_ESTRATEGIA = 'Confirme uma direção estratégica (seção 08) para liberar este bloco.'

export function SecaoRedes() {
  const state = useGeradorState()
  const gerar = useGerarBloco()
  const estrategia = state.decisoes.estrategiaEscolhida
  const abordagem = state.decisoes.abordagemOrganicoEscolhida
  const gateAbordagem = { enabled: !!abordagem, msg: 'Escolha uma abordagem orgânica primeiro.' }
  const ctxOrg = () => `${ctxBase(state)}\n\nAbordagem orgânica escolhida:\n${JSON.stringify(abordagem)}`

  return (
    <>
      <Hint>
        A mesa de roteiro/copy orgânico propõe abordagens visuais e narrativas antes de escrever os 12
        posts completos (2 carrosséis, 6 estáticos de feed, 4 status/stories).
      </Hint>
      <MesaEspecialistas
        mesa="abordagemOrganico"
        promptOpcoes={PROMPT_ORGANICO_MESA}
        camposOrdem={CAMPOS_MESA.abordagemOrganico}
        multi={false}
        maxTokens={2500}
        labelRodar="Rodar mesa de roteiro/copy (Redes Sociais)"
        labelLoading="Rodando a mesa de roteiro/copy orgânico…"
        gate={{ enabled: !!estrategia, msg: GATE_ESTRATEGIA }}
        buildContexto={() => ctxBase(state)}
      />
      <BlocoGerador
        label="Gerar carrosséis"
        successMsg="Carrosséis gerados — veja no documento abaixo."
        gate={gateAbordagem}
        onGerar={async (progress) => {
          progress('Gerando os 2 carrosséis de Instagram…')
          await gerar(PROMPT_ORGANICO_CARROSSEIS, ctxOrg(), 8000, true, BLOCO_TITULOS.organicoCarrosseis)
        }}
      />
      <BlocoGerador
        label="Gerar estáticos + status"
        successMsg="Estáticos e status gerados — veja no documento abaixo."
        gate={gateAbordagem}
        onGerar={async (progress) => {
          progress('Gerando os 6 posts estáticos + 4 status/stories…')
          await gerar(PROMPT_ORGANICO_ESTATICOS, ctxOrg(), 8000, true, BLOCO_TITULOS.organicoEstaticos)
        }}
      />
    </>
  )
}
