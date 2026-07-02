// Context + Provider do Gerador de Campanhas. Mantém o estado grande via useReducer
// e persiste automaticamente em localStorage para sobreviver à navegação/reload
// (o /gerador é uma rota; sair e voltar desmonta o componente).
import { createContext, useContext, useEffect, useReducer, useRef } from 'react'
import type { Dispatch, ReactNode } from 'react'
import type { GeradorState } from '../../types/gerador'
import { geradorReducer, INITIAL_STATE, restaurarDeSessao } from './geradorReducer'
import type { GeradorAction } from './geradorReducer'
import { desserializarSessao, serializarSessao } from './sessao'

const StateContext = createContext<GeradorState | null>(null)
const DispatchContext = createContext<Dispatch<GeradorAction> | null>(null)

// Rascunho de trabalho atual (autosave). Não guarda arquivos (base64) — mesmo
// critério da sessão .json — para não estourar a cota do localStorage.
const AUTOSAVE_KEY = 'gerador_autosave'

function salvarAutosave(state: GeradorState): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serializarSessao(state, new Date().toISOString())))
  } catch {
    /* cota cheia / indisponível — ignora */
  }
}

function estadoInicial(): GeradorState {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (raw) return restaurarDeSessao(desserializarSessao(raw))
  } catch {
    /* localStorage indisponível ou JSON inválido — começa do zero */
  }
  return INITIAL_STATE
}

export function GeradorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(geradorReducer, undefined, estadoInicial)
  const primeiroRender = useRef(true)
  // Mantém o estado mais recente acessível no cleanup de desmontagem.
  const stateRef = useRef(state)
  stateRef.current = state

  // Autosave em localStorage (debounce). Pula o primeiro render (acabou de restaurar).
  useEffect(() => {
    if (primeiroRender.current) {
      primeiroRender.current = false
      return
    }
    const t = setTimeout(() => salvarAutosave(state), 500)
    return () => clearTimeout(t)
  }, [state])

  // Flush ao desmontar (trocar de rota) e ao sair da página (reload/fechar aba):
  // grava o estado atual mesmo que o debounce ainda não tenha disparado — sem isso,
  // sair logo após digitar perdia o progresso.
  useEffect(() => {
    const flush = () => salvarAutosave(stateRef.current)
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [])

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  )
}

export function limparAutosave() {
  try {
    localStorage.removeItem(AUTOSAVE_KEY)
  } catch {
    /* ignora */
  }
}

export function useGeradorState(): GeradorState {
  const ctx = useContext(StateContext)
  if (!ctx) throw new Error('useGeradorState precisa estar dentro de <GeradorProvider>')
  return ctx
}

export function useGeradorDispatch(): Dispatch<GeradorAction> {
  const ctx = useContext(DispatchContext)
  if (!ctx) throw new Error('useGeradorDispatch precisa estar dentro de <GeradorProvider>')
  return ctx
}
