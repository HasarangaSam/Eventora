import { useEffect, useState, type ReactNode } from 'react'
import { IconX, IconAlertTriangle } from './icons'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(15,23,42,0.65)] p-5 backdrop-blur-[6px] animate-[fadeIn_0.18s_ease]" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="w-full max-w-[540px] overflow-hidden rounded-[var(--radius-xl)] bg-white shadow-[0_25px_50px_-12px_rgba(15,23,42,0.3)] animate-[modalPop_0.22s_cubic-bezier(0.16,1,0.3,1)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
          <h3 id="modal-title" className="m-0 text-lg font-bold text-[var(--text-main)]">{title}</h3>
          <button type="button" className="flex items-center rounded-[var(--radius-sm)] border-0 bg-transparent p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-main)] [&_svg]:h-[18px] [&_svg]:w-[18px]" onClick={onClose} aria-label="Close dialog">
            <IconX />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
  loading?: boolean
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col">
        {destructive && (
          <div className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger-bg)] text-[var(--danger)] [&_svg]:h-6 [&_svg]:w-6">
            <IconAlertTriangle />
          </div>
        )}
        <p className="m-0 text-sm leading-[1.5] text-[var(--text-muted)]">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)]" onClick={onClose} disabled={loading}>
            {cancelText}
          </button>
          <button
            type="button"
            className={destructive ? "inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#ef4444_0%,#dc2626_100%)] text-white shadow-[0_2px_8px_rgba(239,68,68,0.25)] enabled:hover:bg-[#dc2626] enabled:hover:shadow-[0_4px_14px_rgba(239,68,68,0.35)] enabled:hover:translate-y-[-1px]" : "inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px]"}
            onClick={() => void onConfirm()}
            disabled={loading}
          >
            {loading ? 'Processing…' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}

interface PromptModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (value: string) => void | Promise<void>
  title: string
  message: string
  placeholder?: string
  label?: string
  confirmText?: string
  cancelText?: string
  minLength?: number
  loading?: boolean
}

export function PromptModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  placeholder = '',
  label = 'Reason',
  confirmText = 'Submit',
  cancelText = 'Cancel',
  minLength = 1,
  loading = false,
}: PromptModalProps) {
  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <PromptForm
        onClose={onClose}
        onConfirm={onConfirm}
        message={message}
        placeholder={placeholder}
        label={label}
        confirmText={confirmText}
        cancelText={cancelText}
        minLength={minLength}
        loading={loading}
      />
    </Modal>
  )
}

function PromptForm({
  onClose,
  onConfirm,
  message,
  placeholder,
  label,
  confirmText,
  cancelText,
  minLength,
  loading,
}: Omit<PromptModalProps, 'isOpen' | 'title'>) {
  const [value, setValue] = useState('')
  const isValid = value.trim().length >= (minLength ?? 1)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (isValid && !loading) {
          void onConfirm(value.trim())
        }
      }}
    >
      <p className="m-0 text-sm leading-[1.5] text-[var(--text-muted)]">{message}</p>
      <div className="mb-[18px] flex flex-col gap-1.5" style={{ margin: '16px 0' }}>
        <label className="text-[13px] font-semibold text-[var(--text-main)]" htmlFor="prompt-input">
          {label} {minLength && minLength > 1 && <span className="text-muted text-xs">(min {minLength} characters)</span>}
        </label>
        <textarea
          id="prompt-input"
          className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
          rows={3}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          autoFocus
        />
        {minLength && minLength > 1 && (
          <div className="mt-1 text-xs text-[var(--text-muted)]" style={{ marginTop: '4px' }}>
            {value.trim().length}/{minLength} characters entered
          </div>
        )}
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)]" onClick={onClose} disabled={loading}>
          {cancelText}
        </button>
        <button type="submit" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#ef4444_0%,#dc2626_100%)] text-white shadow-[0_2px_8px_rgba(239,68,68,0.25)] enabled:hover:bg-[#dc2626] enabled:hover:shadow-[0_4px_14px_rgba(239,68,68,0.35)] enabled:hover:translate-y-[-1px]" disabled={!isValid || loading}>
          {loading ? 'Submitting…' : confirmText}
        </button>
      </div>
    </form>
  )
}
