import { createContext, useCallback, useContext, useReducer } from 'react'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
  duration: number
}

type ToastAction =
  | { type: 'ADD'; payload: ToastItem }
  | { type: 'REMOVE'; id: string }

function toastReducer(state: ToastItem[], action: ToastAction): ToastItem[] {
  switch (action.type) {
    case 'ADD':
      return [...state, action.payload]
    case 'REMOVE':
      return state.filter((t) => t.id !== action.id)
  }
}

interface ToastContextValue {
  toasts: ToastItem[]
  dispatch: React.Dispatch<ToastAction>
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, [])
  return (
    <ToastContext.Provider value={{ toasts, dispatch }}>
      {children}
    </ToastContext.Provider>
  )
}

function useToastContext(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const { dispatch } = useToastContext()

  const add = useCallback(
    (message: string, variant: ToastVariant, duration = 4000) => {
      const id = `toast-${Date.now()}-${Math.floor(Math.random() * 10000)}`
      dispatch({ type: 'ADD', payload: { id, message, variant, duration } })
    },
    [dispatch],
  )

  return {
    toast: {
      success: (message: string, duration?: number) => add(message, 'success', duration),
      error: (message: string, duration?: number) => add(message, 'error', duration),
      warning: (message: string, duration?: number) => add(message, 'warning', duration),
      info: (message: string, duration?: number) => add(message, 'info', duration),
    },
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToastItems(): ToastContextValue {
  return useToastContext()
}
