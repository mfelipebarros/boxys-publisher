// Serialização/desserialização de sessão (.json). Porta coletarEstadoSessao/
// aplicarEstadoSessao (html 2441-2611). Arquivos (base64) NÃO são persistidos,
// igual ao protótipo — só formulário, decisões, textos e blocos.
import type { GeradorState, SessaoGerador } from '../../types/gerador'
import { CHANGELOG } from '../../lib/gerador/changelog'

export function serializarSessao(state: GeradorState, salvoEm: string): SessaoGerador {
  return {
    versaoGerador: CHANGELOG.length,
    salvoEm,
    formulario: state.formulario,
    arquivos: [],
    decisoes: state.decisoes,
    textosGerados: state.textosGerados,
    blocosRegistro: state.blocosRegistro,
    tituloCampanha: state.tituloCampanha,
    outputCompleto: state.outputCompleto,
  }
}

export function desserializarSessao(texto: string): SessaoGerador {
  const raw = JSON.parse(texto)
  if (!raw || typeof raw !== 'object' || !('formulario' in raw)) {
    throw new Error('Arquivo de sessão inválido ou de outra ferramenta.')
  }
  return raw as SessaoGerador
}
