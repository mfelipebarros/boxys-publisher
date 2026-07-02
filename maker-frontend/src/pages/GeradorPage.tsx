import type { ReactNode } from 'react'
import { GeradorProvider } from '../hooks/gerador/useGerador'
import { CHANGELOG } from '../lib/gerador/changelog'
import { SecaoTipoCampanha } from '../components/gerador/briefing/SecaoTipoCampanha'
import { SecaoAngulos } from '../components/gerador/briefing/SecaoAngulos'
import { SecaoMaterial } from '../components/gerador/briefing/SecaoMaterial'
import { SecaoCorretor } from '../components/gerador/briefing/SecaoCorretor'
import { SecaoRestricoes } from '../components/gerador/briefing/SecaoRestricoes'
import { SecaoCalibrador } from '../components/gerador/briefing/SecaoCalibrador'
import { SecaoPerfilPublico } from '../components/gerador/mesa/SecaoPerfilPublico'
import { SecaoEstrategia } from '../components/gerador/mesa/SecaoEstrategia'

// Seções do gerador (html: 01-15). PR5+ preenche as mesas (07-15).
const SECOES: { num: string; titulo: string; render?: () => ReactNode }[] = [
  { num: '01', titulo: 'Tipo de campanha', render: () => <SecaoTipoCampanha /> },
  { num: '02', titulo: 'Ângulos de campanha', render: () => <SecaoAngulos /> },
  { num: '03', titulo: 'Material de referência', render: () => <SecaoMaterial /> },
  { num: '04', titulo: 'Corretor de referência', render: () => <SecaoCorretor /> },
  { num: '05', titulo: 'Restrições e Informações Extras', render: () => <SecaoRestricoes /> },
  { num: '06', titulo: 'Calibrador de Estilo de Copy', render: () => <SecaoCalibrador /> },
  { num: '07', titulo: 'Mesa de Perfil de Público', render: () => <SecaoPerfilPublico /> },
  { num: '08', titulo: 'Mesa de Estratégia', render: () => <SecaoEstrategia /> },
  { num: '09', titulo: 'Bloco: Ads (Meta + Google)' },
  { num: '10', titulo: 'Bloco: Vídeos' },
  { num: '11', titulo: 'Bloco: Redes Sociais' },
  { num: '12', titulo: 'Bloco: Landing Page' },
  { num: '13', titulo: 'Bloco: App / Teaser' },
  { num: '14', titulo: 'Bloco: Configuração de Tráfego Pago' },
  { num: '15', titulo: 'Bloco: Síntese das Estratégias' },
]

export function SectionCard({ num, titulo, children }: { num: string; titulo: string; children?: ReactNode }) {
  return (
    <section className="bg-[var(--surface)] border border-[var(--line)] rounded-[var(--radius)] p-6 mb-4">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="font-mono text-xs text-[var(--accent)] bg-[var(--accent-bg)] rounded px-2 py-1">{num}</span>
        <h2 className="text-base font-semibold text-[var(--ink)]">{titulo}</h2>
      </div>
      {children ?? <p className="text-sm text-[var(--muted)]">Em construção.</p>}
    </section>
  )
}

function GeradorInner() {
  return (
    <>
      <header className="mb-8 border-b border-[var(--line)] pb-5">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-[var(--ink)]">Gerador de Campanhas</h1>
          <span className="text-[10px] font-bold text-[var(--accent)] bg-[var(--accent-bg)] px-2 py-0.5 rounded-full">
            v{CHANGELOG.length}
          </span>
        </div>
        <p className="text-sm text-[var(--muted)] max-w-2xl">
          Preencha o briefing do empreendimento ou do tipo de campanha. O método Boxys — mesa de
          especialistas, DNA de marca e estrutura completa de entregáveis — devolve o pacote pronto
          para virar campanha.
        </p>
      </header>

      {SECOES.map((s) => (
        <SectionCard key={s.num} num={s.num} titulo={s.titulo}>
          {s.render ? s.render() : undefined}
        </SectionCard>
      ))}
    </>
  )
}

export function GeradorPage() {
  return (
    <GeradorProvider>
      <div className="max-w-3xl mx-auto">
        <GeradorInner />
      </div>
    </GeradorProvider>
  )
}
