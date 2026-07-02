import { Hint } from '../ui'
import { MesaEspecialistas } from '../mesa/MesaEspecialistas'
import { BlocoGerador } from '../output/BlocoGerador'
import { useGeradorState } from '../../../hooks/gerador/useGerador'
import { useGerarBloco } from '../../../hooks/gerador/useGerarBloco'
import { ctxBase } from '../../../lib/gerador/contexto'
import { CAMPOS_MESA, BLOCO_TITULOS } from '../../../lib/gerador/camposMesa'
import { PROMPT_VIDEOS_CINE, PROMPT_VIDEOS_TEMPLATES, PROMPT_VIDEO_CASTING } from '../../../lib/gerador/prompts'

const GATE_ESTRATEGIA = 'Confirme uma direção estratégica (seção 08) para liberar este bloco.'

export function SecaoVideos() {
  const state = useGeradorState()
  const gerar = useGerarBloco()
  const estrategia = state.decisoes.estrategiaEscolhida
  const casting = state.decisoes.castingVideoEscolhidos

  return (
    <>
      <Hint>
        A mesa de roteiro decide o(s) arquétipo(s)/casting de identificação antes de escrever os 8
        roteiros completos (6 templates de anúncio + 2 cinematográficos). Você pode escolher mais de um
        arquétipo — os 2 vídeos cinematográficos podem usar personagens diferentes.
      </Hint>
      <MesaEspecialistas
        mesa="castingVideo"
        promptOpcoes={PROMPT_VIDEO_CASTING}
        camposOrdem={CAMPOS_MESA.castingVideo}
        multi
        maxTokens={2500}
        labelRodar="Rodar mesa de roteiro (Vídeos)"
        labelLoading="Rodando a mesa de roteiro/casting…"
        gate={{ enabled: !!estrategia, msg: GATE_ESTRATEGIA }}
        buildContexto={() => ctxBase(state)}
      />
      <BlocoGerador
        label="Gerar bloco de Vídeos"
        successMsg="Bloco de Vídeos gerado com sucesso — veja no documento abaixo."
        gate={{ enabled: casting.length > 0, msg: 'Escolha e confirme ao menos um arquétipo de personagem primeiro.' }}
        onGerar={async (progress) => {
          const ctxBaseStr = ctxBase(state)
          const ctxCasting = `${ctxBaseStr}\n\nArquétipo(s) de personagem escolhido(s) para os vídeos cinematográficos (se houver mais de um, distribua um arquétipo por vídeo cinematográfico, deixando claro qual personagem está em qual vídeo):\n${JSON.stringify(casting)}`
          progress('Parte 1/2 — 6 vídeos-template de anúncio…')
          await gerar(PROMPT_VIDEOS_TEMPLATES, ctxBaseStr, 8000, true, BLOCO_TITULOS.videosTemplates, 'textoVideosTemplates')
          progress('Parte 2/2 — 2 vídeos de captação cinematográfica…')
          await gerar(PROMPT_VIDEOS_CINE, ctxCasting, 6000, false, BLOCO_TITULOS.videosCine, 'textoVideosCine')
        }}
      />
    </>
  )
}
