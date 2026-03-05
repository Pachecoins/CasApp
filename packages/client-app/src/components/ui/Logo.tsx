import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'full' | 'icon'
}

export function Logo({ className, size = 'md', variant = 'full' }: LogoProps) {
  const sizes = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl',
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Icon */}
      <div
        className={cn(
          'rounded-2xl bg-primary flex items-center justify-center flex-shrink-0',
          size === 'sm' && 'w-8 h-8',
          size === 'md' && 'w-10 h-10',
          size === 'lg' && 'w-14 h-14',
        )}
      >
        <span
          className={cn(
            size === 'sm' && 'text-base',
            size === 'md' && 'text-xl',
            size === 'lg' && 'text-3xl',
          )}
        >
          🏠
        </span>
      </div>
      {/* Text */}
      {variant === 'full' && (
        <span className={cn('font-heading font-bold text-gray-900', sizes[size])}>
          Cas<span className="text-primary">App</span>
        </span>
      )}
    </div>
  )
}
