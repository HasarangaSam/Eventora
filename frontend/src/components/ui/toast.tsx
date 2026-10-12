import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
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
      <div className="toast-portal" aria-live="polite" aria-atomic="true">
        {toasts.map((item) => (
          <div key={item.id} className={`toast-card toast-card--${item.type}`} role="status">
            <div className="toast-card__icon">
              {item.type === 'success' && <IconCheck />}
              {item.type === 'error' && <IconAlertCircle />}
              {item.type === 'warning' && <IconAlertTriangle />}
              {item.type === 'info' && <IconInfo />}
            </div>
            <div className="toast-card__content">
              <strong className="toast-card__title">{item.title}</strong>
              {item.message && <p className="toast-card__message">{item.message}</p>}
            </div>
            <button
              type="button"
              className="toast-card__close"
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
