import { AxiosError } from 'axios'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { IconCamera, IconTrash, IconSparkles } from '../../../components/ui/icons'
import { getEventPlaceholder } from '../../../lib/placeholders'

interface CoverImageUploaderProps {
  currentImageUrl?: string | null
  selectedFile?: File | null
  onFileSelect: (file: File | null) => void
  onUploadNow?: (file: File) => Promise<void>
  onDeleteCurrent?: () => Promise<void>
  fallbackTitle?: string
  disabled?: boolean
  className?: string
}

const MAX_SIZE_MB = 5
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function CoverImageUploader({
  currentImageUrl,
  selectedFile,
  onFileSelect,
  onUploadNow,
  onDeleteCurrent,
  fallbackTitle = 'Event Banner',
  disabled = false,
  className = '',
}: CoverImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Manage object URL for local file preview
  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(selectedFile)
    setPreviewUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [selectedFile])

  const validateAndHandle = useCallback(
    async (file: File) => {
      setError(null)
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError('Only JPEG, PNG, or WebP images are supported.')
        return
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError(`Image size exceeds ${MAX_SIZE_MB} MB limit. Please compress or choose a smaller image.`)
        return
      }

      onFileSelect(file)

      if (onUploadNow) {
        setBusy(true)
        try {
          await onUploadNow(file)
        } catch (err: unknown) {
          const apiMessage = err instanceof AxiosError ? err.response?.data?.message : undefined
          setError(typeof apiMessage === 'string' ? apiMessage : 'Failed to upload image. Please try again.')
        } finally {
          setBusy(false)
        }
      }
    },
    [onFileSelect, onUploadNow],
  )

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragOver(false)
      if (disabled || busy) return
      const droppedFile = e.dataTransfer.files?.[0]
      if (droppedFile) {
        void validateAndHandle(droppedFile)
      }
    },
    [busy, disabled, validateAndHandle],
  )

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!disabled && !busy) setDragOver(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleBrowseClick = () => {
    if (disabled || busy) return
    fileInputRef.current?.click()
  }

  const handleRemove = async () => {
    if (disabled || busy) return
    setError(null)
    if (selectedFile) {
      onFileSelect(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } else if (currentImageUrl && onDeleteCurrent) {
      setBusy(true)
      try {
        await onDeleteCurrent()
      } catch (err: unknown) {
        const apiMessage = err instanceof AxiosError ? err.response?.data?.message : undefined
        setError(typeof apiMessage === 'string' ? apiMessage : 'Could not reset cover image.')
      } finally {
        setBusy(false)
      }
    }
  }

  const activeDisplayUrl = previewUrl || currentImageUrl || null
  const hasCustomImage = Boolean(activeDisplayUrl)

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        disabled={disabled || busy}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            void validateAndHandle(file)
          }
        }}
      />

      {/* Main Banner Canvas / Drop Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-200 ${
          dragOver
            ? 'border-indigo-500 bg-indigo-50/50 shadow-lg ring-4 ring-indigo-100'
            : hasCustomImage
              ? 'border-slate-200 bg-slate-900 shadow-sm hover:border-indigo-300'
              : 'border-dashed border-slate-300 bg-slate-50/80 hover:border-indigo-400 hover:bg-slate-100/70'
        }`}
        style={{ aspectRatio: '16 / 9', maxHeight: '360px' }}
      >
        {/* Banner Media or Placeholder */}
        {hasCustomImage ? (
          <img
            src={activeDisplayUrl!}
            alt={fallbackTitle}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="relative flex h-full w-full flex-col items-center justify-center p-6 text-center">
            {/* Background subtle placeholder art */}
            <img
              src={getEventPlaceholder(fallbackTitle)}
              alt="Default placeholder"
              className="absolute inset-0 h-full w-full object-cover opacity-25 filter blur-[1px]"
            />
            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/90 text-indigo-600 shadow-md backdrop-blur-sm transition-transform duration-200 group-hover:scale-110">
                <IconCamera className="h-7 w-7" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-800">
                  {dragOver ? 'Drop your banner here' : 'Add an Event Cover Banner'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Drag & drop, or click to browse. 16:9 ratio recommended (up to 5 MB)
                </p>
              </div>
              <button
                type="button"
                onClick={handleBrowseClick}
                disabled={disabled || busy}
                className="mt-1 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50 hover:text-indigo-600 active:scale-95 disabled:opacity-50"
              >
                <IconCamera className="h-4 w-4 text-indigo-500" />
                Select Image File
              </button>
            </div>
          </div>
        )}

        {/* Hover / Active Overlay Controls when an image exists */}
        {hasCustomImage && (
          <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-slate-950/80 via-transparent to-black/30 p-4 opacity-95 transition-opacity md:opacity-0 md:group-hover:opacity-100">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                <IconSparkles className="h-3.5 w-3.5 text-amber-300" />
                {previewUrl ? 'Preview (pending upload)' : 'Custom Banner'}
              </span>

              {onDeleteCurrent && (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={disabled || busy}
                  title="Remove custom banner"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-600/90 text-white shadow-sm transition hover:bg-rose-700 active:scale-90"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleBrowseClick}
                disabled={disabled || busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/95 px-3.5 py-2 text-xs font-bold text-slate-800 shadow-md backdrop-blur-sm transition hover:bg-white hover:text-indigo-600 active:scale-95"
              >
                <IconCamera className="h-4 w-4 text-indigo-600" />
                Change Banner
              </button>
              {previewUrl && !onUploadNow && (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={disabled || busy}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-200 backdrop-blur-sm transition hover:bg-slate-800"
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>
        )}

        {/* Busy Spinner */}
        {busy && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-xs text-white">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
            <p className="mt-2 text-xs font-semibold">Updating banner image…</p>
          </div>
        )}
      </div>

      {/* Guidelines and Feedback Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500">
        <span>JPEG, PNG, or WebP. Optimal resolution: 1920×1080 (16:9). Max 5 MB.</span>
        {selectedFile && (
          <span className="font-medium text-indigo-600">
            Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
          {error}
        </div>
      )}
    </div>
  )
}
