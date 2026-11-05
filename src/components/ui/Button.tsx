import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-pitch-600 text-white hover:bg-pitch-500 active:bg-pitch-700 shadow-[0_6px_20px_-8px_rgba(22,179,100,0.7)]',
  secondary: 'bg-coal-800 text-coal-100 hover:bg-coal-700 active:bg-coal-800 border border-coal-700',
  outline:
    'border border-pitch-700/70 bg-transparent text-pitch-300 hover:bg-pitch-950/60 hover:border-pitch-600',
  ghost: 'bg-transparent text-coal-300 hover:bg-coal-800/70 hover:text-coal-100',
  danger: 'bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-[15px] gap-2 rounded-xl',
  lg: 'h-12 px-5 text-base gap-2 rounded-xl',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    fullWidth,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center font-semibold transition-all duration-150',
        'focus-visible:ring-2 focus-visible:ring-pitch-500 focus-visible:ring-offset-2 focus-visible:ring-offset-coal-950',
        'disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        icon
      )}
      {children}
    </button>
  )
})
