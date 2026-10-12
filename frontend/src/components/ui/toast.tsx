import { createContext, useCallback, useContext, useState, type CSSProperties, type ReactNode } from 'react'
import { IconCheck, IconAlertCircle, IconAlertTriangle, IconInfo, IconX } from './icons'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  title: string
  message?: string
  durationMs?: number
}

interface ToastContextValue {
  toast: {
    success: (title: string, message?: string, durationMs?: number) => void
    error: (title: string, message?: string, durationMs?: number) => void
    warning: (title: string, message?: string, durationMs?: number) => void
    info: (title: string, message?: string, durationMs?: number) => void
    dismiss: (id: string) => void
  }
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((type: ToastType, title: string, message?: string, durationMs = 4500) => {
    const id = Math.random().toString(36).slice(2, 9)
    const newToast: ToastItem = { id, type, title, message, durationMs }

    setToasts((prev) => [...prev.slice(-4), newToast])

    if (durationMs > 0) {
      setTimeout(() => {
        dismiss(id)
      }, durationMs)
    }
  }, [dismiss])

  const contextValue: ToastContextValue = {
    toast: {
      success: (title, message, duration) => addToast('success', title, message, duration),
      error: (title, message, duration) => addToast('error', title, message, duration),
      warning: (title, message, duration) => addToast('warning', title, message, duration),
      info: (title, message, duration) => addToast('info', title, message, duration),
      dismiss,
    },
  }

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="pointer-events-none fixed right-6 bottom-6 z-[9999] flex w-[calc(100vw-48px)] max-w-[420px] flex-col gap-2.5" aria-live="polite" aria-atomic="true">
        {toasts.map((item) => (
          <div key={item.id} className="pointer-events-auto flex items-start gap-3 rounded-[var(--radius-md)] border-l-4 border-solid border-l-[var(--toast-border)] bg-white px-[18px] py-3.5 shadow-[0_10px_25px_-5px_rgba(15,23,42,0.2),0_8px_10px_-6px_rgba(15,23,42,0.1)] transition-all duration-200 animate-[toastSlideIn_0.25s_cubic-bezier(0.16,1,0.3,1)]" style={{ '--toast-border': item.type === 'success' ? 'var(--success)' : item.type === 'error' ? 'var(--danger)' : item.type === 'warning' ? 'var(--warning)' : 'var(--primary)' } as CSSProperties} role="status">
            <div className={`mt-px h-5 w-5 shrink-0 ${item.type === 'success' ? 'text-[var(--success)]' : item.type === 'error' ? 'text-[var(--danger)]' : item.type === 'warning' ? 'text-[var(--warning)]' : 'text-[var(--primary)]'}`}>
              {item.type === 'success' && <IconCheck />}
              {item.type === 'error' && <IconAlertCircle />}
              {item.type === 'warning' && <IconAlertTriangle />}
              {item.type === 'info' && <IconInfo />}
            </div>
            <div className="flex-1">
              <strong className="block text-sm leading-[1.3] font-semibold text-[var(--text-main)]">{item.title}</strong>
              {item.message && <p className="mt-1 text-[13px] leading-[1.4] text-[var(--text-muted)]">{item.message}</p>}
            </div>
            <button
              type="button"
              className="flex items-center justify-center rounded-[var(--radius-sm)] border-0 bg-transparent p-0.5 text-[var(--text-subtle)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-main)] [&_svg]:h-4 [&_svg]:w-4"
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss notification"
            >
              <IconX />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context.toast
}
