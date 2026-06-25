import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Button } from './Button'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' }

export function Modal({ title, onClose, children, footer, size = 'md' }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.7)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className={`w-full ${sizes[size]} bg-[var(--surface)] border border-[var(--line)] rounded-[var(--radius)] shadow-xl flex flex-col max-h-[90vh]`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line)]">
          <h2 className="text-base font-semibold text-[var(--ink)]">{title}</h2>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--ink)] text-xl leading-none transition-colors"
          >×</button>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--line)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function ModalFooter({ onClose, onConfirm, confirmLabel = 'Salvar', loading }: {
  onClose: () => void
  onConfirm?: () => void
  confirmLabel?: string
  loading?: boolean
}) {
  return (
    <>
      <Button variant="secondary" onClick={onClose}>Cancelar</Button>
      {onConfirm && (
        <Button onClick={onConfirm} disabled={loading}>
          {loading ? 'Aguarde…' : confirmLabel}
        </Button>
      )}
    </>
  )
}
