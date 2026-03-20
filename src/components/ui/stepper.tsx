import { Check } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface Step {
  id: number
  title: string
  description?: string
}

interface StepperProps {
  steps: Step[]
  currentStep: number
  className?: string
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <nav aria-label="Progresso do formulário" className={cn('w-full', className)}>
      {/* Mobile: progress bar + counter */}
      <div className="flex items-center gap-3 sm:hidden mb-6">
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
          {currentStep} de {steps.length}
        </span>
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          />
        </div>
        <span className="text-sm font-medium text-foreground whitespace-nowrap">
          {steps[currentStep - 1]?.title}
        </span>
      </div>

      {/* Desktop: full step indicators */}
      <ol className="hidden sm:flex items-center gap-0">
        {steps.map((step, index) => {
          const isCompleted = step.id < currentStep
          const isActive = step.id === currentStep
          const isLast = index === steps.length - 1

          return (
            <li key={step.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  aria-current={isActive ? 'step' : undefined}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300 text-sm font-semibold',
                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                    isActive && 'border-primary bg-background text-primary',
                    !isCompleted && !isActive && 'border-border bg-background text-muted-foreground',
                  )}
                >
                  {isCompleted ? <Check size={14} strokeWidth={3} /> : step.id}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium whitespace-nowrap',
                    isActive && 'text-foreground',
                    isCompleted && 'text-primary',
                    !isCompleted && !isActive && 'text-muted-foreground',
                  )}
                >
                  {step.title}
                </span>
              </div>

              {!isLast && (
                <div
                  className={cn(
                    'h-0.5 flex-1 mx-2 mb-5 transition-all duration-300',
                    isCompleted ? 'bg-primary' : 'bg-border',
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
