import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'secondary'
  size?: 'sm' | 'md'
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', className = '', children, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-semibold rounded-lg cursor-pointer transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap font-[var(--ui)]'
    const sizes = { sm: 'text-xs px-3 py-1.5', md: 'text-sm px-3.5 py-2' }
    const variants = {
      primary: 'bg-[var(--accent)] text-white hover:bg-[var(--accent-deep)]',
      ghost: 'bg-transparent text-[var(--accent)] border border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white',
      secondary: 'bg-[var(--surface-raised)] text-[var(--ink-soft)] border border-[var(--line)] hover:border-[var(--muted)] hover:text-[var(--ink)]',
      danger: 'bg-transparent text-[var(--red)] border border-[var(--red)] hover:bg-[var(--red)] hover:text-white',
    }
    return (
      <button ref={ref} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
