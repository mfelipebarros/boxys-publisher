import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Modal, ModalFooter } from '../ui/Modal'
import { Textarea } from '../ui/Input'

interface Props {
  campaignId: string
  onClose: () => void
}

interface ImportResult {
  status: string
  created: number
  errors: string[]
}

export function ImportCopiesModal({ campaignId, onClose }: Props) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () =>
      api.post<ImportResult>(`/api/campaigns/${campaignId}/copies/import`, { text, type: 'auto' }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['local-campaign', campaignId] })
      setResult(data)
    },
    onError: (e: Error) => setError(e.message),
  })

  if (result) {
    return (
      <Modal
        title="Resultado do import"
        onClose={onClose}
        footer={<button onClick={onClose} className="text-sm text-[var(--accent)] hover:underline">Fechar</button>}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--ink-soft)]">
            <span className="font-semibold text-[var(--ink)]">{result.created}</span> cop{result.created !== 1 ? 'ies' : 'y'} criada{result.created !== 1 ? 's' : ''}.
          </p>
          {result.errors.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[var(--red)] mb-1">Erros:</p>
              <ul className="text-xs text-[var(--muted)] list-disc list-inside space-y-0.5">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title="Importar copies"
      onClose={onClose}
      size="lg"
      footer={
        <ModalFooter
          onClose={onClose}
          onConfirm={() => { setError(''); mut.mutate() }}
          confirmLabel="Importar"
          loading={mut.isPending}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-[var(--muted)]">
          O tipo é detectado automaticamente pelo ID de cada bloco:<br />
          <span className="font-mono text-[var(--ink-soft)]">[CAMP]-[CANAL]-[FORMATO][NN]</span> — formato <span className="font-mono">S</span> = Search, demais = Criativo.
        </p>

        <div>
          <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Texto estruturado</label>
          <Textarea
            placeholder={`Variação: 01\nid: var-01\nTítulo: Headline aqui\nDescrição: Texto da descrição\nMensagem/CTA: Saiba mais\n\nVariação: 02\n...`}
            value={text}
            onChange={e => setText(e.target.value)}
            rows={14}
            className="font-mono text-xs"
          />
        </div>

        {error && <p className="text-xs text-[var(--red)]">{error}</p>}
      </div>
    </Modal>
  )
}
