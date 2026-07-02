import { useState } from 'react'
import { CHANGELOG } from '../../../lib/gerador/changelog'

export function ChangelogToggle() {
  const [aberto, setAberto] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="text-xs font-semibold text-[var(--accent)] hover:underline"
      >
        {aberto ? 'Ocultar histórico' : `Ver histórico de atualizações (${CHANGELOG.length})`}
      </button>
      {aberto && (
        <div className="mt-3 max-h-72 overflow-y-auto bg-[var(--surface-raised)] border border-[var(--line)] rounded-[var(--radius)] p-4">
          <ol className="list-none space-y-1.5">
            {CHANGELOG.map((item, i) => (
              <li key={i} className="text-xs text-[var(--ink-soft)] leading-relaxed">
                <span className="font-bold text-[var(--accent)]">v{i + 1}.</span> {item}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
