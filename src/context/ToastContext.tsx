import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '../lib/cn'

type ToastTone = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: number
  tone: ToastTone
  message: string
  title?: string
}

interface ToastApi {
  success: (message: string, title?: string) => void
  error: (message: string, title?: string) => void
  info: (message: string, title?: string) => void
  warning: (message: string, title?: string) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const TONE_CONFIG: Record<ToastTone, { icon: ReactNode; className: string; duration: number }> = {
  success: {
    icon: <CheckCircle2 className="h-5 w-5 text-pitch-400" />,
    className: 'border-pitch-800/70 bg-coal-900/95',
    duration: 3500,
  },
  error: {
    icon: <XCircle className="h-5 w-5 text-rose-400" />,
    className: 'border-rose-900/70 bg-coal-900/95',
    duration: 6000,
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5 text-amber-400" />,
    className: 'border-amber-900/70 bg-coal-900/95',
    duration: 5000,
  },
  info: {
    icon: <Info className="h-5 w-5 text-sky-400" />,
    className: 'border-sky-900/70 bg-coal-900/95',
    duration: 4000,
  },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (tone: ToastTone, message: string, title?: string) => {
      const id = nextId.current
      nextId.current += 1
      // Cap the stack so a burst of realtime events can't bury the screen.
      setToasts((prev) => [...prev.slice(-3), { id, tone, message, title }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), TONE_CONFIG[tone].duration)
      )
    },
    [dismiss]
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (m, t) => push('success', m, t),
      error: (m, t) => push('error', m, t),
      info: (m, t) => push('info', m, t),
      warning: (m, t) => push('warning', m, t),
      dismiss,
    }),
    [push, dismiss]
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-3 pt-3 sm:left-auto sm:right-4 sm:top-4 sm:items-end sm:px-0 sm:pt-0"
          role="region"
          aria-label="Notifications"
        >
          {toasts.map((toast) => {
            const config = TONE_CONFIG[toast.tone]
            return (
              <div
                key={toast.id}
                role={toast.tone === 'error' ? 'alert' : 'status'}
                className={cn(
                  'pointer-events-auto flex w-full max-w-sm animate-slide-down items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md',
                  config.className
                )}
              >
                <span className="mt-0.5 shrink-0">{config.icon}</span>
                <div className="min-w-0 flex-1">
                  {toast.title && (
                    <p className="text-sm font-semibold text-coal-50">{toast.title}</p>
                  )}
                  <p className={cn('text-sm text-coal-300', toast.title && 'mt-0.5')}>
                    {toast.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Dismiss notification"
                  className="-mr-1 shrink-0 rounded-md p-1 text-coal-500 transition-colors hover:bg-coal-800 hover:text-coal-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
