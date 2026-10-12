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
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 id="modal-title" className="modal-title">{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">
            <IconX />
          </button>
        </div>
        <div className="modal-body">{children}</div>
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
      <div className="confirm-modal-content">
        {destructive && (
          <div className="confirm-modal-icon confirm-modal-icon--destructive">
            <IconAlertTriangle />
          </div>
        )}
        <p className="confirm-modal-message">{message}</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </button>
          <button
            type="button"
            className={destructive ? 'btn btn-destructive' : 'btn btn-primary'}
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
      <p className="confirm-modal-message">{message}</p>
      <div className="form-group" style={{ margin: '16px 0' }}>
        <label className="form-label" htmlFor="prompt-input">
          {label} {minLength && minLength > 1 && <span className="text-muted text-xs">(min {minLength} characters)</span>}
        </label>
        <textarea
          id="prompt-input"
          className="form-textarea"
          rows={3}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          autoFocus
        />
        {minLength && minLength > 1 && (
          <div className="form-hint" style={{ marginTop: '4px' }}>
            {value.trim().length}/{minLength} characters entered
          </div>
        )}
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
          {cancelText}
        </button>
        <button type="submit" className="btn btn-destructive" disabled={!isValid || loading}>
          {loading ? 'Submitting…' : confirmText}
        </button>
      </div>
    </form>
  )
}
