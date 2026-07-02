import { Chip, Hint } from '../ui'
import { useGeradorDispatch, useGeradorState } from '../../../hooks/gerador/useGerador'
import { ANGULOS } from '../../../lib/gerador/angulos'

export function SecaoAngulos() {
  const angulos = useGeradorState().formulario.angulos
  const dispatch = useGeradorDispatch()
  const n = angulos.length
  return (
    <>
      <Hint>
        Selecione um ou mais ângulos — uma campanha pode combinar vários. Eles definem a perspectiva
        criativa, independente do tipo/segmento acima.
      </Hint>
      <p className="text-xs font-mono text-[var(--muted)] mb-3">
        {n === 0 ? '0 selecionados' : `${n} selecionado${n > 1 ? 's' : ''}`}
      </p>
      <div className="flex flex-wrap gap-2">
        {ANGULOS.map((a) => (
          <Chip key={a} label={a} active={angulos.includes(a)} onClick={() => dispatch({ type: 'TOGGLE_ANGULO', angulo: a })} />
        ))}
      </div>
    </>
  )
}
