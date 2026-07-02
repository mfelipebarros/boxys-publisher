// Primitivos de UI reutilizados pelas seções do gerador (tema dark Boxys).
import type { ReactNode } from 'react'

export function Field({ label, hint, children }: { label?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      {label && <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1.5">{label}</label>}
      {children}
      {hint && <p className="text-xs text-[var(--muted)] mt-1">{hint}</p>}
    </div>
  )
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-[var(--muted)] mb-3">{children}</p>
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
}

export interface ToggleOption<T extends string> {
  value: T
  label: string
}

export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ToggleOption<T>[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--line)] overflow-hidden mb-3">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3.5 py-2 text-sm font-medium transition-colors ${
            value === opt.value
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--surface-raised)] text-[var(--muted)] hover:text-[var(--ink-soft)]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
        active
          ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
          : 'bg-[var(--surface-raised)] border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--muted)]'
      }`}
    >
      {label}
    </button>
  )
}

// Loader de 3 pontos (porta .loader do protótipo).
export function DotLoader({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
      <span className="inline-flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse [animation-delay:300ms]" />
      </span>
      {children}
    </div>
  )
}

export function StatusMsg({ error, children }: { error?: boolean; children: ReactNode }) {
  return (
    <p className={`text-xs mt-2 ${error ? 'text-[var(--red)]' : 'text-[var(--muted)]'}`}>{children}</p>
  )
}
