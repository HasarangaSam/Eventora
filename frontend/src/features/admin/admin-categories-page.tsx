import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { DashboardShell } from '../analytics/dashboard-shell'
import { useToast } from '../../components/ui/toast'
import { ConfirmModal } from '../../components/ui/modal'
import { IconPlus, IconTrash } from '../../components/ui/icons'

interface CategoryRecord {
  id: string
  name: string
  slug: string
  description: string | null
  isActive: boolean
}

export function AdminCategoriesPage() {
  const request = useAuthenticatedApi()
  const toast = useToast()
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)

  // Delete confirm modal
  const [deleteTarget, setDeleteTarget] = useState<CategoryRecord | null>(null)

  const refresh = useCallback(async () => {
    try {
      const { data } = await request<CategoryRecord[]>({ method: 'GET', url: '/categories/admin/list' })
      setCategories(data)
    } catch {
      toast.error('Taxonomy Error', 'Category management is unavailable.')
    } finally {
      setLoading(false)
    }
  }, [request, toast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function createCategory(e: FormEvent) {
    e.preventDefault()
    try {
      await request({ method: 'POST', url: '/categories', data: { name, description } })
      toast.success('Category Created', `“${name}” is now available for events.`)
      setName('')
      setDescription('')
      await refresh()
    } catch {
      toast.error('Creation Failed', 'Could not create category. Duplicate name or slug exists.')
    }
  }

  async function updateCategory(cat: CategoryRecord) {
    try {
      await request({ method: 'PATCH', url: `/categories/${cat.id}`, data: cat })
      toast.success('Category Saved', `Updated “${cat.name}”.`)
      await refresh()
    } catch {
      toast.error('Save Failed', 'Could not save category changes.')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await request({ method: 'DELETE', url: `/categories/${deleteTarget.id}` })
      toast.success('Category Deleted', `“${deleteTarget.name}” removed.`)
      setDeleteTarget(null)
      await refresh()
    } catch {
      toast.error('Cannot Delete', 'This category is actively referenced by events. Disable it instead to preserve history.')
      setDeleteTarget(null)
    }
  }

  return (
    <DashboardShell role="ADMIN" pageTitle="Category Taxonomy Management">
      <section className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ margin: 0 }}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5 [&_h3]:m-0 [&_h3]:text-lg [&_h3]:font-bold">
          <div>
            <h3>Discovery Categories ({categories.length})</h3>
            <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
              Create event classifications, manage public slugs, and toggle visibility.
            </p>
          </div>
        </div>

        {/* Add Category Form */}
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
          <form onSubmit={createCategory} style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr auto', gap: '14px', alignItems: 'flex-end' }}>
            <div className="mb-[18px] flex flex-col gap-1.5" style={{ margin: 0 }}>
              <label className="text-[13px] font-semibold text-[var(--text-main)]">Category Name</label>
              <input
                required
                minLength={2}
                maxLength={100}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Technology & AI"
              />
            </div>
            <div className="mb-[18px] flex flex-col gap-1.5" style={{ margin: 0 }}>
              <label className="text-[13px] font-semibold text-[var(--text-main)]">Description (Optional)</label>
              <input
                maxLength={2000}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of events in this category"
              />
            </div>
            <button type="submit" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px]" style={{ height: '42px' }}>
              <IconPlus /> Add Category
            </button>
          </form>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-left [&_th]:border-b [&_th]:border-[var(--border)] [&_th]:bg-slate-50 [&_th]:px-5 [&_th]:py-3.5 [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-[0.5px] [&_th]:text-[var(--text-muted)] [&_th]:uppercase [&_td]:border-b [&_td]:border-[var(--border)] [&_td]:px-5 [&_td]:py-4 [&_td]:text-sm [&_td]:text-[var(--text-main)] [&_td]:align-middle [&_tr:last-child_td]:border-b-0 [&_tr:hover_td]:bg-slate-50">
            <thead>
              <tr>
                <th>Category Name</th>
                <th>URL Slug</th>
                <th>Description</th>
                <th>Public Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '32px' }}>Loading categories…</td>
                </tr>
              ) : categories.map((cat) => (
                <tr key={cat.id}>
                  <td>
                    <input
                      className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                      style={{ padding: '6px 10px', fontSize: '13px' }}
                      value={cat.name}
                      onChange={(e) => setCategories(categories.map((c) => (c.id === cat.id ? { ...c, name: e.target.value } : c)))}
                    />
                  </td>
                  <td>
                    <span className="text-muted" style={{ fontSize: '12px', fontFamily: 'monospace' }}>{cat.slug}</span>
                  </td>
                  <td>
                    <input
                      className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                      style={{ padding: '6px 10px', fontSize: '13px' }}
                      value={cat.description ?? ''}
                      onChange={(e) => setCategories(categories.map((c) => (c.id === cat.id ? { ...c, description: e.target.value } : c)))}
                    />
                  </td>
                  <td>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none capitalize ${cat.isActive ? "border border-[#a7f3d0] bg-[#ecfdf5] text-[#059669] [--badge-dot-color:#10b981]" : "border border-slate-200 bg-slate-100 text-slate-600 [--badge-dot-color:#64748b]"}`}>
                      <span className="h-[6px] w-[6px] rounded-full bg-[var(--badge-dot-color)]" />
                      {cat.isActive ? 'Public' : 'Hidden'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border-0 bg-transparent px-2 py-1 text-[13px] font-semibold text-[var(--text-button-color,var(--primary))] cursor-pointer transition-[all] duration-150 hover:bg-[var(--text-button-bg,var(--primary-light))] hover:text-[var(--text-button-hover,var(--primary-hover))]" onClick={() => void updateCategory(cat)}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border-0 bg-transparent px-2 py-1 text-[13px] font-semibold text-[var(--text-button-color,var(--primary))] cursor-pointer transition-[all] duration-150 hover:bg-[var(--text-button-bg,var(--primary-light))] hover:text-[var(--text-button-hover,var(--primary-hover))]"
                      onClick={() => void updateCategory({ ...cat, isActive: !cat.isActive })}
                    >
                      {cat.isActive ? 'Hide' : 'Publish'}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border-0 bg-transparent px-2 py-1 text-[13px] font-semibold text-[var(--text-button-color,var(--primary))] cursor-pointer transition-[all] duration-150 hover:bg-[var(--text-button-bg,var(--primary-light))] hover:text-[var(--text-button-hover,var(--primary-hover))] [--text-button-color:var(--danger)] [--text-button-hover:#b91c1c] [--text-button-bg:var(--danger-bg)]"
                      onClick={() => setDeleteTarget(cat)}
                    >
                      <IconTrash style={{ width: '14px', height: '14px' }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Delete Category Confirmation Dialog */}
        <ConfirmModal
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title={`Delete “${deleteTarget?.name}”?`}
          message="Are you sure you want to delete this category? Categories already referenced by events cannot be removed and should be hidden instead."
          destructive
          confirmText="Delete Category"
        />
      </section>
    </DashboardShell>
  )
}
