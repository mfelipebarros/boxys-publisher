import type { ReactNode } from 'react'
import { GeradorProvider, useGeradorState, useGeradorDispatch } from '../hooks/gerador/useGerador'
import { CHANGELOG } from '../lib/gerador/changelog'

// Seções do gerador (html: 01-15). PR4+ preenche cada uma com o conteúdo real.
const SECOES: { num: string; titulo: string }[] = [
  { num: '01', titulo: 'Tipo de campanha' },
  { num: '02', titulo: 'Ângulos de campanha' },
  { num: '03', titulo: 'Material de referência' },
  { num: '04', titulo: 'Corretor de referência' },
  { num: '05', titulo: 'Restrições e Informações Extras' },
  { num: '06', titulo: 'Calibrador de Estilo de Copy' },
  { num: '07', titulo: 'Mesa de Perfil de Público' },
  { num: '08', titulo: 'Mesa de Estratégia' },
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

// Prova mínima de que o estado funciona (será substituído pelas seções reais no PR4).
function BriefingSmoke() {
  const state = useGeradorState()
  const dispatch = useGeradorDispatch()
  const f = state.formulario
  return (
    <div className="space-y-3">
      <input
        type="text"
        value={f.nomeEmp}
        onChange={(e) => dispatch({ type: 'SET_CAMPO', campo: 'nomeEmp', valor: e.target.value })}
        placeholder="Nome do empreendimento (teste de estado)"
        className="w-full bg-[var(--surface-raised)] border border-[var(--line)] rounded-lg px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
      />
      <p className="text-xs font-mono text-[var(--muted)]">
        título derivado: <span className="text-[var(--ink-soft)]">{f.nomeEmp || 'campanha-boxys'}</span>
      </p>
    </div>
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
          {s.num === '01' ? <BriefingSmoke /> : undefined}
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
