import { useState } from 'react'
import { Select } from '../ui/Input'
import { getModeloGerador, setModeloGerador, MODELOS_GERADOR } from '../../lib/gerador/config'

// Seleciona o modelo de IA usado nas gerações (persistido em localStorage).
export function ModeloSelector() {
  const [modelo, setModelo] = useState(getModeloGerador())

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value
    setModeloGerador(v)
    setModelo(v)
  }

  return (
    <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
      <span className="whitespace-nowrap">Modelo de IA</span>
      <Select value={modelo} onChange={onChange} className="!w-auto !py-1 text-xs">
        {MODELOS_GERADOR.map((m) => (
          <option key={m.id} value={m.id}>{m.label}</option>
        ))}
      </Select>
    </label>
  )
}
