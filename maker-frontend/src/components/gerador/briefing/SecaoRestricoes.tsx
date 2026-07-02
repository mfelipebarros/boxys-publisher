import { Textarea } from '../../ui/Input'
import { Field, Hint } from '../ui'
import { useGeradorDispatch, useGeradorState } from '../../../hooks/gerador/useGerador'

export function SecaoRestricoes() {
  const f = useGeradorState().formulario
  const dispatch = useGeradorDispatch()
  return (
    <>
      <Hint>
        Regras negativas (o que NUNCA pode aparecer em nenhuma peça) e qualquer contexto extra que não
        se encaixa nos campos acima. Isso entra automaticamente em todas as mesas e blocos gerados.
      </Hint>
      <Field label="Restrições da campanha (o que não pode ser feito)">
        <Textarea
          value={f.restricoesCampanha}
          onChange={(e) => dispatch({ type: 'SET_CAMPO', campo: 'restricoesCampanha', valor: e.target.value })}
          rows={3}
          placeholder="Ex: não mencionar preço em nenhuma peça pública / não citar concorrentes diretos / não usar humor / evitar tom de urgência artificial..."
        />
      </Field>
      <Field label="Informações extras a considerar">
        <Textarea
          value={f.infoExtraCampanha}
          onChange={(e) => dispatch({ type: 'SET_CAMPO', campo: 'infoExtraCampanha', valor: e.target.value })}
          rows={3}
          placeholder="Ex: a incorporadora pediu para não usar drone nas artes / o corretor prefere não aparecer em vídeo..."
        />
      </Field>
    </>
  )
}
