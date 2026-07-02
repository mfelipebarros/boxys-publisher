// Context + Provider do Gerador de Campanhas. Mantém o estado grande via useReducer
// (sem Redux/Zustand — não estão no projeto).
import { createContext, useContext, useReducer } from 'react'
import type { Dispatch, ReactNode } from 'react'
import type { GeradorState } from '../../types/gerador'
import { geradorReducer, INITIAL_STATE } from './geradorReducer'
import type { GeradorAction } from './geradorReducer'

const StateContext = createContext<GeradorState | null>(null)
const DispatchContext = createContext<Dispatch<GeradorAction> | null>(null)

export function GeradorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(geradorReducer, INITIAL_STATE)
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  )
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
