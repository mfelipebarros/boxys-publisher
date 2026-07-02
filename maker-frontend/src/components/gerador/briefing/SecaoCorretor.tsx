import { Input } from '../../ui/Input'
import { Field, Hint, Row } from '../ui'
import { useGeradorDispatch, useGeradorState } from '../../../hooks/gerador/useGerador'

export function SecaoCorretor() {
  const f = useGeradorState().formulario
  const dispatch = useGeradorDispatch()
  return (
    <>
      <Hint>Usado nos placeholders de personalização das copys.</Hint>
      <Row>
        <Field label="Nome do corretor (ou deixar {CORRETOR_NOME})">
          <Input value={f.corretorNome} onChange={(e) => dispatch({ type: 'SET_CAMPO', campo: 'corretorNome', valor: e.target.value })} placeholder="{CORRETOR_NOME}" />
        </Field>
        <Field label="Especialidade / diferencial do corretor">
          <Input value={f.corretorEsp} onChange={(e) => dispatch({ type: 'SET_CAMPO', campo: 'corretorEsp', valor: e.target.value })} placeholder="Ex: especialista em alto padrão na Zona Oeste" />
        </Field>
      </Row>
    </>
  )
}
