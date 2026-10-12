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
      <section className="table-card" style={{ margin: 0 }}>
        <div className="table-header">
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
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Category Name</label>
              <input
                required
                minLength={2}
                maxLength={100}
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Technology & AI"
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Description (Optional)</label>
              <input
                maxLength={2000}
                className="form-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of events in this category"
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ height: '42px' }}>
              <IconPlus /> Add Category
            </button>
          </form>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
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
                      className="form-input"
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
                      className="form-input"
                      style={{ padding: '6px 10px', fontSize: '13px' }}
                      value={cat.description ?? ''}
                      onChange={(e) => setCategories(categories.map((c) => (c.id === cat.id ? { ...c, description: e.target.value } : c)))}
                    />
                  </td>
                  <td>
                    <span className={`badge ${cat.isActive ? 'badge-emerald' : 'badge-slate'}`}>
                      <span className="badge-dot" />
                      {cat.isActive ? 'Public' : 'Hidden'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" className="text-button" onClick={() => void updateCategory(cat)}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => void updateCategory({ ...cat, isActive: !cat.isActive })}
                    >
                      {cat.isActive ? 'Hide' : 'Publish'}
                    </button>
                    <button
                      type="button"
                      className="text-button text-button--destructive"
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
