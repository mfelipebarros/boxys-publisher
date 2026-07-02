import { useMemo, useState } from 'react'
import { Button } from '../../ui/Button'
import { AjusteBlocoPanel } from './AjusteBlocoPanel'
import { useGeradorState } from '../../../hooks/gerador/useGerador'
import { mdToHtml } from '../../../lib/gerador/brief'
import { copyTextRobusto, downloadMarkdown, printPdf } from '../../../lib/gerador/download'

export function DocumentoGerado() {
  const state = useGeradorState()
  const { outputCompleto, tituloCampanha, blocosRegistro } = state
  const [copyLabel, setCopyLabel] = useState('Copiar')

  const html = useMemo(() => mdToHtml(outputCompleto), [outputCompleto])

  if (!blocosRegistro.length) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Gere os blocos acima (Ads, Vídeos, Redes, LP, App, Tráfego, Síntese) para montar o documento
        completo da campanha aqui.
      </p>
    )
  }

  function copiar() {
    copyTextRobusto(outputCompleto)
      .then(() => setCopyLabel('Copiado!'))
      .catch(() => setCopyLabel('Falhou — use Baixar .md'))
      .finally(() => setTimeout(() => setCopyLabel('Copiar'), 2000))
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <Button variant="secondary" onClick={copiar}>{copyLabel}</Button>
        <Button variant="secondary" onClick={() => downloadMarkdown(outputCompleto, tituloCampanha)}>Baixar .md</Button>
        <Button variant="secondary" onClick={() => printPdf(html, tituloCampanha)}>Baixar PDF</Button>
      </div>

      <div
        className="gerador-doc max-h-[520px] overflow-y-auto bg-[var(--surface-raised)] border border-[var(--line)] rounded-[var(--radius)] p-5 text-sm text-[var(--ink-soft)] leading-relaxed"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <AjusteBlocoPanel />
    </div>
  )
}
