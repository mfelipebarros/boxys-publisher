import { Hint } from '../ui'
import { MesaEspecialistas } from './MesaEspecialistas'
import { useGeradorState } from '../../../hooks/gerador/useGerador'
import { buildBrief } from '../../../lib/gerador/brief'
import { PROMPT_PERFIL_PUBLICO_OPCOES } from '../../../lib/gerador/prompts'
import { CAMPOS_MESA } from '../../../lib/gerador/camposMesa'
import type { Opcao } from '../../../types/gerador'

export function SecaoPerfilPublico() {
  const state = useGeradorState()
  const brief = () => buildBrief(state.formulario, state.arquivos)

  return (
    <>
      <Hint>
        O primeiro passo de toda campanha. A mesa de segmentação (Alan Cooper, Clayton Christensen,
        Clotaire Rapaille, Byron Sharp) propõe 3 perfis distintos. Você pode escolher mais de um — os
        perfis escolhidos orientam todas as mesas seguintes.
      </Hint>
      <MesaEspecialistas
        mesa="perfilPublico"
        promptOpcoes={PROMPT_PERFIL_PUBLICO_OPCOES}
        camposOrdem={CAMPOS_MESA.perfilPublico}
        multi
        maxTokens={3000}
        labelRodar="Rodar mesa de perfil de público"
        labelLoading="Rodando a mesa de perfil de público…"
        permitirRegerar
        buildContexto={() => `Briefing de entrada:\n\n${brief()}`}
        buildContextoRegerar={(feedback: string, ultimas: Opcao[]) =>
          `Briefing de entrada:\n\n${brief()}\n\nVocê já propôs estas opções de perfil de público anteriormente:\n${JSON.stringify(ultimas)}\n\nO usuário avaliou essas opções e pediu o seguinte ajuste:\n"${feedback}"\n\nGere 3 NOVAS opções de perfil de público, diferentes das anteriores, já incorporando esse ajuste.`
        }
      />
    </>
  )
}
