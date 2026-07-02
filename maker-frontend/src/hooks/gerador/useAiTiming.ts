// Hooks React em cima de lib/gerador/timing.ts (cronômetro das chamadas de IA).
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getTotalAiTime, subscribeAiTime } from '../../lib/gerador/timing'

// Tempo total acumulado de IA nesta sessão do navegador (ao vivo).
export function useTotalAiTime(): number {
  return useSyncExternalStore(subscribeAiTime, getTotalAiTime, getTotalAiTime)
}

// Cronômetro ao vivo enquanto `active` for true — para mostrar "Rodando… 12s".
export function useElapsedTimer(active: boolean): number {
  const [elapsedMs, setElapsedMs] = useState(0)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (!active) return
    startRef.current = Date.now()
    setElapsedMs(0)
    const id = setInterval(() => {
      if (startRef.current != null) setElapsedMs(Date.now() - startRef.current)
    }, 250)
    return () => clearInterval(id)
  }, [active])

  return elapsedMs
}
