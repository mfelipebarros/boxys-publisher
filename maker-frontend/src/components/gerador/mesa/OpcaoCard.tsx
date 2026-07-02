import type { Opcao } from '../../../types/gerador'

// Card de opção proposta por uma mesa (porta renderOpcoes, html 1569-1598).
export function OpcaoCard({
  opcao,
  camposOrdem,
  selected,
  onClick,
}: {
  opcao: Opcao
  camposOrdem: [string, string][]
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-[var(--radius)] border p-4 transition-colors ${
        selected
          ? 'border-[var(--accent)] bg-[var(--accent-bg)]'
          : 'border-[var(--line)] bg-[var(--surface-raised)] hover:border-[var(--muted)]'
      }`}
    >
      <div className="font-semibold text-sm text-[var(--ink)] mb-2">{opcao.titulo || 'Opção'}</div>
      {camposOrdem.map(([campo, label]) =>
        opcao[campo] ? (
          <div key={campo} className="text-xs text-[var(--ink-soft)] leading-relaxed mb-1">
            <span className="font-semibold text-[var(--muted)]">{label}</span>
            {opcao[campo]}
          </div>
        ) : null,
      )}
    </button>
  )
}
