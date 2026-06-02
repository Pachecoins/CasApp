import { type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant }

const variants: Record<Variant, string> = {
  primary: 'bg-military hover:bg-military/80 text-bone font-stencil tracking-widest',
  secondary: 'border border-sand/30 hover:border-sand/60 hover:bg-sand/5 text-sand font-stencil tracking-widest',
  ghost: 'hover:bg-white/5 text-bone',
  danger: 'bg-red-900/50 hover:bg-red-900/70 text-red-200',
}

export function Button({ variant = 'primary', className = '', disabled, children, ...props }: ButtonProps) {
  return (
    <button disabled={disabled}
      className={`flex items-center justify-center px-4 py-3 rounded-sm uppercase text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}>
      {children}
    </button>
  )
}
