import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '../../ui/Button'
import { DotLoader, Hint, StatusMsg } from '../ui'
import { useGeradorState } from '../../../hooks/gerador/useGerador'
import { api } from '../../../lib/api'
import { buildBrief } from '../../../lib/gerador/brief'

interface CriarBoxysResp {
  status: string
  boxy_campaign?: { id: number }
  local_campaign?: { id: number }
  error?: string
}

interface ExtractResp {
  status: string
  campaign?: Record<string, string>
  copies?: unknown[]
  error?: string
}

// A ponte documento→campanha. Cria a campanha no Boxys, extrai copies do documento
// gerado (reusa ai_extract), persiste via bulk e grava o briefing; navega para /boxys/:id.
export function FinalizarCampanha() {
  const state = useGeradorState()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [progresso, setProgresso] = useState('')
  const [status, setStatus] = useState<{ msg: string; error?: boolean } | null>(null)

  const pronto = state.blocosRegistro.length > 0

  async function finalizar() {
    setLoading(true)
    setStatus(null)
    try {
      setProgresso('Criando campanha no Boxys…')
      const criada = await api.post<CriarBoxysResp>('/api/boxys/campaigns', {
        title: state.tituloCampanha || 'Campanha Boxys',
        description: '',
        create_local: true,
      })
      const boxyId = criada.boxy_campaign?.id
      const localId = criada.local_campaign?.id
      if (!boxyId || !localId) throw new Error('Falha ao criar a campanha (IDs ausentes).')

      setProgresso('Extraindo peças do documento gerado…')
      const extracao = await api.post<ExtractResp>(`/api/campaigns/${localId}/copies/extract`, {
        text: state.outputCompleto,
      })
      const copies = extracao.copies ?? []

      setProgresso(`Salvando ${copies.length} copies…`)
      await api.post(`/api/campaigns/${localId}/copies/bulk`, {
        copies,
        campaign: extracao.campaign ?? null,
      })

      setProgresso('Gravando briefing e documento…')
      await api.put(`/api/campaigns/${localId}`, {
        briefing_text: buildBrief(state.formulario, state.arquivos),
        general_description: state.outputCompleto,
      })

      qc.invalidateQueries({ queryKey: ['boxy-campaigns'] })
      qc.invalidateQueries({ queryKey: ['local-campaigns'] })
      navigate(`/boxys/${boxyId}`)
    } catch (err) {
      setStatus({ msg: 'Erro ao finalizar: ' + (err instanceof Error ? err.message : String(err)), error: true })
    } finally {
      setLoading(false)
      setProgresso('')
    }
  }

  return (
    <>
      <Hint>
        Cria a campanha no Boxys a partir deste documento: as copies (Ads, Redes, LP, App) são extraídas
        e já aparecem nas abas da campanha; o briefing e o documento completo ficam salvos. O bloco de
        tráfego pago fica no documento para você reconfigurar na aba Tráfego Pago.
      </Hint>
      <Button onClick={finalizar} disabled={!pronto || loading}>
        {loading ? 'Finalizando…' : 'Criar campanha no Boxys a partir deste documento'}
      </Button>
      {!pronto && <StatusMsg>Gere ao menos um bloco antes de criar a campanha.</StatusMsg>}
      {loading && progresso && <div className="mt-2"><DotLoader>{progresso}</DotLoader></div>}
      {!loading && status && <StatusMsg error={status.error}>{status.msg}</StatusMsg>}
    </>
  )
}
