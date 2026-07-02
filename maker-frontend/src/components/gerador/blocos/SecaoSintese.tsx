import { Hint } from '../ui'
import { BlocoGerador } from '../output/BlocoGerador'
import { useGeradorState } from '../../../hooks/gerador/useGerador'
import { useGerarBloco } from '../../../hooks/gerador/useGerarBloco'
import { ctxSintese } from '../../../lib/gerador/contexto'
import { BLOCO_TITULOS } from '../../../lib/gerador/camposMesa'
import { PROMPT_SINTESE } from '../../../lib/gerador/prompts'

export function SecaoSintese() {
  const state = useGeradorState()
  const gerar = useGerarBloco()
  const estrategia = state.decisoes.estrategiaEscolhida

  return (
    <>
      <Hint>
        Compila todas as decisões das mesas em um documento conectado que explica por que cada escolha
        foi feita e como elas se reforçam. Não tem mesa — usa o que já foi decidido (o que não foi fica
        marcado como "não definido ainda").
      </Hint>
      <BlocoGerador
        label="Gerar síntese estratégica"
        successMsg="Síntese gerada — veja no documento abaixo."
        gate={{ enabled: !!estrategia, msg: 'Confirme ao menos a direção estratégica (seção 08) para gerar a síntese.' }}
        onGerar={async (progress) => {
          progress('Compilando a síntese estratégica…')
          await gerar(PROMPT_SINTESE, ctxSintese(state), 3000, false, BLOCO_TITULOS.sintese)
        }}
      />
    </>
  )
}
