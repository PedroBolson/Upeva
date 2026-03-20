import { forwardRef } from 'react'
import { cn } from '@/utils/cn'

type Variant = 'default' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link' | 'inverted'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variantClasses: Record<Variant, string> = {
  default:
    'bg-primary text-primary-foreground hover:opacity-90 active:opacity-80',
  secondary:
    'bg-secondary text-secondary-foreground hover:opacity-90 active:opacity-80',
  outline:
    'border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
  ghost:
    'bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
  danger:
    'bg-danger text-danger-foreground hover:opacity-90 active:opacity-80',
  link:
    'bg-transparent text-primary underline-offset-4 hover:underline p-0 h-auto',
  inverted:
    'bg-white text-primary hover:bg-white/90 active:bg-white/80',
}

const sizeClasses: Record<Size, string> = {
  sm:   'h-8 px-3 text-xs gap-1.5',
  md:   'h-10 px-4 text-sm gap-2',
  lg:   'h-12 px-6 text-base gap-2',
  icon: 'h-10 w-10',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'md',
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled ?? loading}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium',
          'transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            {children}
          </span>
        ) : (
          children
        )}
      </button>
    )
  },
)

Button.displayName = 'Button'
