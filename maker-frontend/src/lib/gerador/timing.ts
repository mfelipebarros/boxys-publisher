// Cronômetro das chamadas de IA do Gerador. Armazenamento simples (fora do
// reducer — não faz parte da sessão salva) com pub-sub para o total ao vivo.

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  if (m === 0) return `${s}s`
  return `${m}m ${String(s).padStart(2, '0')}s`
}

type Listener = () => void

let totalMs = 0
const listeners = new Set<Listener>()

function notify(): void {
  listeners.forEach((l) => l())
}

export function addAiTime(ms: number): void {
  totalMs += ms
  notify()
}

export function getTotalAiTime(): number {
  return totalMs
}

export function resetAiTime(): void {
  totalMs = 0
  notify()
}

export function subscribeAiTime(cb: Listener): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
