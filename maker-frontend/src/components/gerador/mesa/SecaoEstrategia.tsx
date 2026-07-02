import { Hint } from '../ui'
import { MesaEspecialistas } from './MesaEspecialistas'
import { useGeradorState } from '../../../hooks/gerador/useGerador'
import { buildBrief } from '../../../lib/gerador/brief'
import { PROMPT_ESTRATEGIA_OPCOES } from '../../../lib/gerador/prompts'
import { CAMPOS_MESA } from '../../../lib/gerador/camposMesa'
import type { Opcao } from '../../../types/gerador'

export function SecaoEstrategia() {
  const state = useGeradorState()
  const perfis = state.decisoes.perfisPublicoEscolhidos
  const brief = () => buildBrief(state.formulario, state.arquivos)

  return (
    <>
      <Hint>
        Antes de qualquer copy, a mesa de estratégia (Schwartz, Hopkins, Hormozi, Sutherland, Sharp,
        Kennedy) propõe direções distintas com base no briefing e no perfil de público já escolhido.
        Escolha uma para seguir — ela desbloqueia os blocos abaixo.
      </Hint>
      <MesaEspecialistas
        mesa="estrategia"
        promptOpcoes={PROMPT_ESTRATEGIA_OPCOES}
        camposOrdem={CAMPOS_MESA.estrategia}
        multi={false}
        maxTokens={3000}
        labelRodar="Rodar mesa de estratégia"
        labelLoading="Rodando a mesa de estratégia…"
        permitirRegerar
        gate={{
          enabled: perfis.length > 0,
          msg: 'Rode a mesa de perfil de público e confirme ao menos um perfil — a estratégia é construída em cima deles.',
        }}
        buildContexto={() =>
          `Briefing de entrada:\n\n${brief()}\n\nPerfis de público escolhidos (a campanha pode ter mais de um; se houver mais de um, decida a abordagem mais eficiente — falar com todos com um argumento comum, ou segmentar peças por perfil — e explique brevemente a escolha):\n${JSON.stringify(perfis)}`
        }
        buildContextoRegerar={(feedback: string, ultimas: Opcao[]) =>
          `Briefing de entrada:\n\n${brief()}\n\nPerfis de público escolhidos:\n${JSON.stringify(perfis)}\n\nVocê já propôs estas direções estratégicas anteriormente:\n${JSON.stringify(ultimas)}\n\nO usuário avaliou essas direções e pediu o seguinte ajuste:\n"${feedback}"\n\nGere 3 NOVAS direções estratégicas, diferentes das anteriores, já incorporando esse ajuste.`
        }
      />
    </>
  )
}
