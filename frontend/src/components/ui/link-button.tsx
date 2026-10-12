import type { ComponentProps } from 'react'
import { Link } from 'react-router'

type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: 'primary' | 'secondary' | 'subtle'
  size?: 'default' | 'small'
}

const variants = {
  primary:
    'border border-transparent bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] hover:shadow-[0_5px_14px_rgba(79,70,229,0.3)]',
  secondary:
    'border border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] hover:border-slate-300 hover:bg-[var(--surface-hover)]',
  subtle:
    'border border-transparent bg-transparent text-[var(--text-muted)] hover:bg-slate-100 hover:text-[var(--text-main)]',
}

const sizes = {
  default: 'min-h-11 px-5 py-2.5 text-sm',
  small: 'min-h-9 px-3 py-1.5 text-[13px]',
}

export function LinkButton({
  variant = 'primary',
  size = 'default',
  className = '',
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-semibold leading-[1.25] whitespace-nowrap transition-all duration-200 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </Link>
  )
}
