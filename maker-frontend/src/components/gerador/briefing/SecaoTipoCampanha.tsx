import { Input, Select, Textarea } from '../../ui/Input'
import { Field, Hint, Row, ToggleGroup } from '../ui'
import { useGeradorDispatch, useGeradorState } from '../../../hooks/gerador/useGerador'
import { ESTAGIOS, SEGMENTOS } from '../../../lib/gerador/angulos'
import type { FormularioState, TipologiaRow } from '../../../types/gerador'

export function SecaoTipoCampanha() {
  const f = useGeradorState().formulario
  const dispatch = useGeradorDispatch()
  const set = <K extends keyof FormularioState>(campo: K, valor: FormularioState[K]) =>
    dispatch({ type: 'SET_CAMPO', campo, valor })

  const setRow = (idx: number, patch: Partial<TipologiaRow>) =>
    set('tipologiaRows', f.tipologiaRows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  const addRow = () => set('tipologiaRows', [...f.tipologiaRows, { nome: '', metragem: '', valorM2: '' }])
  const removeRow = (idx: number) => set('tipologiaRows', f.tipologiaRows.filter((_, i) => i !== idx))

  return (
    <>
      <ToggleGroup
        value={f.tipoCampanha}
        onChange={(v) => set('tipoCampanha', v)}
        options={[
          { value: 'empreendimento', label: 'Empreendimento específico' },
          { value: 'generica', label: 'Campanha genérica / nicho' },
        ]}
      />

      {f.tipoCampanha === 'empreendimento' ? (
        <div>
          <Row>
            <Field label="Nome do empreendimento">
              <Input value={f.nomeEmp} onChange={(e) => set('nomeEmp', e.target.value)} placeholder="Ex: Ára Faria Lima" />
            </Field>
            <Field label="Incorporadora / Construtora">
              <Input value={f.incorporadora} onChange={(e) => set('incorporadora', e.target.value)} placeholder="Ex: Rezende Empreendimentos" />
            </Field>
          </Row>
          <Row>
            <Field label="Bairro / Cidade">
              <Input value={f.localEmp} onChange={(e) => set('localEmp', e.target.value)} placeholder="Ex: Faria Lima, São Paulo - SP" />
            </Field>
            <Field label="Segmento">
              <Select value={f.segmentoEmp} onChange={(e) => set('segmentoEmp', e.target.value)}>
                {SEGMENTOS.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
          </Row>
          <Row>
            <Field label="Estágio do empreendimento">
              <Select value={f.estagioEmp} onChange={(e) => set('estagioEmp', e.target.value)}>
                {ESTAGIOS.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <div />
          </Row>

          <ToggleGroup
            value={f.modoPreco}
            onChange={(v) => set('modoPreco', v)}
            options={[
              { value: 'unico', label: 'Preço de entrada / referência' },
              { value: 'tipologia', label: 'Preço por tipologia' },
            ]}
          />

          {f.modoPreco === 'unico' ? (
            <div>
              <Hint>Informe a metragem de entrada e o valor do m² — o preço de referência é calculado automaticamente.</Hint>
              <Row>
                <Field label="Metragem de entrada (menor unidade)">
                  <Input value={f.metragemEntrada} onChange={(e) => set('metragemEntrada', e.target.value)} placeholder="Ex: 25m²" />
                </Field>
                <Field label="Valor do m²">
                  <Input value={f.valorM2Entrada} onChange={(e) => set('valorM2Entrada', e.target.value)} placeholder="Ex: R$ 16.800/m²" />
                </Field>
              </Row>
              <Field label="Tipologias e metragens (texto livre, para contexto)">
                <Input value={f.tipologias} onChange={(e) => set('tipologias', e.target.value)} placeholder="Ex: Studios 25m² e 1 dorm 29m²" />
              </Field>
            </div>
          ) : (
            <div>
              <Hint>Informe metragem e valor do m² — o preço final e a comissão são calculados automaticamente.</Hint>
              <div className="space-y-2">
                {f.tipologiaRows.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                    <Input value={r.nome} onChange={(e) => setRow(i, { nome: e.target.value })} placeholder="Ex: 2 dormitórios" />
                    <Input value={r.metragem} onChange={(e) => setRow(i, { metragem: e.target.value })} placeholder="Ex: 55m²" />
                    <Input value={r.valorM2} onChange={(e) => setRow(i, { valorM2: e.target.value })} placeholder="Ex: R$ 8.700/m²" />
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      disabled={f.tipologiaRows.length === 1}
                      className="text-xs text-[var(--muted)] hover:text-[var(--red)] disabled:opacity-40 px-2"
                    >
                      remover
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addRow} className="mt-2 text-xs font-medium text-[var(--accent)] hover:underline">
                + adicionar tipologia
              </button>
            </div>
          )}

          <Row>
            <Field label="Comissionamento do corretor (%)">
              <Input type="number" step="0.1" min="0" value={f.comissaoPct} onChange={(e) => set('comissaoPct', e.target.value)} placeholder="Ex: 5" />
            </Field>
            <Field>
              <p className="text-xs text-[var(--muted)]">
                O valor final em R$ é calculado automaticamente com base no preço informado (único ou por tipologia) e usado junto com o percentual em todo o material de vendas ao corretor.
              </p>
            </Field>
          </Row>

          <Field label="Diferenciais principais (lazer, arquitetura, localização)">
            <Textarea value={f.diferenciais} onChange={(e) => set('diferenciais', e.target.value)} rows={3} placeholder="Ex: rooftop com piscina infinita, hall com pé-direito duplo, ao lado do metrô Faria Lima..." />
          </Field>
        </div>
      ) : (
        <div>
          <Row>
            <Field label="Gancho principal da campanha">
              <Input value={f.ganchoGen} onChange={(e) => set('ganchoGen', e.target.value)} placeholder="Ex: Subsídio de R$55 mil do MCMV" />
            </Field>
            <Field label="Praça / região de atuação">
              <Input value={f.pracaGen} onChange={(e) => set('pracaGen', e.target.value)} placeholder="Ex: Grande São Paulo" />
            </Field>
          </Row>
          <Row>
            <Field label="Segmento">
              <Select value={f.segmentoGen} onChange={(e) => set('segmentoGen', e.target.value)}>
                {SEGMENTOS.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Estágio do empreendimento">
              <Select value={f.estagioGen} onChange={(e) => set('estagioGen', e.target.value)}>
                {ESTAGIOS.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
          </Row>
          <Field label="Perfil de renda / público-alvo">
            <Input value={f.publicoGen} onChange={(e) => set('publicoGen', e.target.value)} placeholder="Ex: famílias com renda a partir de R$4.700" />
          </Field>
        </div>
      )}
    </>
  )
}
