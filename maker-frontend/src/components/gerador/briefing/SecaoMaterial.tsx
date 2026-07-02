import { useState } from 'react'
import { Textarea } from '../../ui/Input'
import { Field, Hint } from '../ui'
import { useGeradorDispatch, useGeradorState } from '../../../hooks/gerador/useGerador'
import { fileToArquivoRef, formatBytes } from '../../../lib/gerador/arquivos'

export function SecaoMaterial() {
  const state = useGeradorState()
  const dispatch = useGeradorDispatch()
  const [erro, setErro] = useState('')

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    setErro('')
    try {
      const novos = await Promise.all(files.map(fileToArquivoRef))
      dispatch({ type: 'SET_ARQUIVOS', arquivos: [...state.arquivos, ...novos] })
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao ler arquivo')
    }
  }

  function remove(idx: number) {
    dispatch({ type: 'SET_ARQUIVOS', arquivos: state.arquivos.filter((_, i) => i !== idx) })
  }

  return (
    <>
      <Hint>
        Anexe book, briefing, plantas, fotos ou qualquer PDF/imagem do empreendimento. O modelo usa
        isso como fonte real, não só o que foi digitado acima.
      </Hint>
      <Field label="Arquivos (PDF ou imagens)">
        <input
          type="file"
          accept=".pdf,image/*"
          multiple
          onChange={onFiles}
          className="block w-full text-sm text-[var(--ink-soft)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--surface-raised)] file:px-3 file:py-1.5 file:text-sm file:text-[var(--ink-soft)] file:cursor-pointer"
        />
      </Field>
      {erro && <p className="text-xs text-[var(--red)] mb-2">{erro}</p>}
      {state.arquivos.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-3">
          {state.arquivos.map((a, i) => (
            <div key={i} className="flex items-center justify-between text-sm bg-[var(--surface-raised)] border border-[var(--line)] rounded-lg px-3 py-1.5">
              <span className="truncate text-[var(--ink-soft)]">
                {a.name} <span className="text-[var(--muted)] font-mono text-xs">{formatBytes(a.size)}</span>
              </span>
              <button type="button" onClick={() => remove(i)} className="text-xs text-[var(--muted)] hover:text-[var(--red)] ml-2">
                remover
              </button>
            </div>
          ))}
        </div>
      )}
      <Field label="Links de sites e observações">
        <Textarea
          value={state.formulario.linksRef}
          onChange={(e) => dispatch({ type: 'SET_CAMPO', campo: 'linksRef', valor: e.target.value })}
          rows={3}
          placeholder="Ex: www.arafarialima.com.br — cole aqui também o texto/descrição relevante do site, já que o link sozinho não é acessado automaticamente pelo modelo."
        />
      </Field>
    </>
  )
}
