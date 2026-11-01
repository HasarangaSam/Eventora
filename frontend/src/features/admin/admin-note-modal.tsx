import { useEffect, useState } from 'react'

export function AdminNoteModal({ open, title, description, label = 'Reason', placeholder, submitLabel = 'Save', onClose, onSubmit }: {
  open: boolean; title: string; description: string; label?: string; placeholder: string; submitLabel?: string
  onClose: () => void; onSubmit: (note: string) => Promise<void>
}) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (open) setNote('') }, [open])
  if (!open) return null
  async function submit() {
    if (note.trim().length < 5 || saving) return
    setSaving(true)
    try { await onSubmit(note.trim()); onClose() } finally { setSaving(false) }
  }
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="admin-note-title" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl"><h2 id="admin-note-title" className="m-0 text-lg font-bold text-slate-900">{title}</h2><p className="mb-4 mt-2 text-sm text-slate-600">{description}</p><label className="block text-sm font-semibold text-slate-800">{label}<textarea autoFocus rows={4} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder={placeholder} className="mt-1.5 block w-full resize-y rounded-lg border border-slate-300 p-3 text-sm font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label><p className="mb-0 mt-1 text-right text-xs text-slate-500">{note.trim().length}/2000 · at least 5 characters</p><div className="mt-5 flex justify-end gap-2"><button disabled={saving} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button><button disabled={saving || note.trim().length < 5} onClick={() => void submit()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : submitLabel}</button></div></section></div>
}
