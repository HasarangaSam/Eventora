import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { DashboardShell } from '../analytics/dashboard-shell'
import { DashboardPanel } from '../analytics/dashboard-panel'
import { useToast } from '../../components/ui/toast'
import { ConfirmModal, PromptModal } from '../../components/ui/modal'
import {
  IconSearch,
  IconCheck,
  IconX,
  IconPlus,
  IconTrash,
  IconExternalLink,
} from '../../components/ui/icons'

interface Application {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  organizationName: string
  description: string
  contactName: string | null
  applicantEmail: string | null
  contactPhone: string | null
  organizerType: string | null
  country: string | null
  city: string | null
  websiteUrl: string | null
  experience: string | null
  eventFrequency: string | null
  expectedAttendance: number | null
  accuracyConfirmed: boolean
  rulesAccepted: boolean
  rulesVersion: string | null
  agreedAt: string | null
  eventCategories: Array<{ category: { id: string; name: string } }>
  submittedAt: string
  applicant: { id: string; email: string; firstName: string | null; lastName: string | null }
}

interface UserRecord {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: 'ATTENDEE' | 'ORGANIZER' | 'ADMIN'
  status: 'ACTIVE' | 'DEACTIVATED'
}

interface CategoryRecord {
  id: string
  name: string
  slug: string
  description: string | null
  isActive: boolean
}

interface ManagedEvent {
  id: string
  title: string
  city: string
  venue: string
  startAt: string
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED'
  ticketsReserved: number
  ticketsSold: number
  organizer: { email: string; firstName: string | null; lastName: string | null }
  _count: { registrations: number; tickets: number }
}

export function AdminPage() {
  const request = useAuthenticatedApi()
  const toast = useToast()
  const [applications, setApplications] = useState<Application[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [applicationResponse, userResponse] = await Promise.all([
        request<Application[]>({ method: 'GET', url: '/organizer-applications?status=PENDING' }),
        request<UserRecord[]>({ method: 'GET', url: '/users' }),
      ])
      setApplications(applicationResponse.data)
      setUsers(userResponse.data)
    } catch {
      toast.error('Data Unavailable', 'Could not refresh platform records. Check administrator permissions.')
    } finally {
      setLoading(false)
    }
  }, [request, toast])

  useEffect(() => {
    let active = true
    void Promise.all([
      request<Application[]>({ method: 'GET', url: '/organizer-applications?status=PENDING' }),
      request<UserRecord[]>({ method: 'GET', url: '/users' }),
    ])
      .then(([applicationResponse, userResponse]) => {
        if (!active) return
        setApplications(applicationResponse.data)
        setUsers(userResponse.data)
      })
      .catch(() => {
        if (active) toast.error('Admin Access Error', 'Confirm that this account has administrator privileges.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [request, toast])

  async function decide(id: string, status: 'APPROVED' | 'REJECTED', orgName: string) {
    try {
      await request({ method: 'PATCH', url: `/organizer-applications/${id}/decision`, data: { status } })
      toast.success(
        status === 'APPROVED' ? 'Application Approved' : 'Application Rejected',
        `${orgName} has been ${status.toLowerCase()}.`,
      )
      await refresh()
    } catch {
      toast.error('Decision Failed', 'The application decision could not be recorded. Please try again.')
    }
  }

  async function updateUser(user: UserRecord, patch: { role?: UserRecord['role']; status?: UserRecord['status'] }) {
    try {
      const [field, value] = Object.entries(patch)[0]
      await request({ method: 'PATCH', url: `/users/${user.id}/${field}`, data: { [field]: value } })
      toast.success('Account Updated', `${user.email} ${field} set to ${value}.`)
      await refresh()
    } catch {
      toast.error('Update Failed', 'That account modification could not be saved. At least one active admin must remain.')
    }
  }

  return (
    <DashboardShell role="ADMIN">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Top Analytics Panel */}
        <div id="overview">
          <DashboardPanel role="ADMIN" />
        </div>

        {/* Organizer Applications Review */}
        <section id="applications" className="table-card">
          <div className="table-header">
            <div>
              <h3>Pending Organizer Applications</h3>
              <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
                Review and approve organizations requesting event publishing permissions.
              </p>
            </div>
            <span className="badge badge-amber">
              <span className="badge-dot" />
              {applications.length} Pending
            </span>
          </div>

          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <p className="text-muted">Loading applications…</p>
            </div>
          ) : applications.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <IconCheck style={{ width: '36px', height: '36px', color: 'var(--success)', margin: '0 auto 8px' }} />
              <p style={{ margin: 0, fontWeight: 600 }}>All applications reviewed</p>
              <span style={{ fontSize: '13px' }}>New submissions will appear here automatically.</span>
            </div>
          ) : (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {applications.map((app) => (
                <div
                  key={app.id}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700 }}>{app.organizationName}</h4>
                      <span className="text-muted" style={{ fontSize: '13px' }}>
                        Applicant: {app.applicant.firstName} {app.applicant.lastName} ({app.applicant.email})
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => void decide(app.id, 'APPROVED', app.organizationName)}
                      >
                        <IconCheck /> Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => void decide(app.id, 'REJECTED', app.organizationName)}
                      >
                        <IconX /> Reject
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '12px',
                      fontSize: '13px',
                      background: '#ffffff',
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div><strong>Contact:</strong> {app.contactName ?? 'N/A'} ({app.contactPhone ?? 'No phone'})</div>
                    <div><strong>Type:</strong> {app.organizerType?.replace(/_/g, ' ') ?? 'General'}</div>
                    <div><strong>Location:</strong> {[app.city, app.country].filter(Boolean).join(', ') || 'Unspecified'}</div>
                    <div>
                      <strong>Website:</strong>{' '}
                      {app.websiteUrl ? (
                        <a href={app.websiteUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          Visit link <IconExternalLink style={{ width: '12px', height: '12px' }} />
                        </a>
                      ) : 'None'}
                    </div>
                    <div><strong>Categories:</strong> {app.eventCategories.map((c) => c.category.name).join(', ') || 'General'}</div>
                    <div><strong>Attendance:</strong> {app.expectedAttendance ? `${app.expectedAttendance.toLocaleString()} attendees` : 'N/A'}</div>
                  </div>

                  <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: 'var(--text-main)' }}>
                    <strong>Motivation / Plan:</strong> {app.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Platform Events Oversight */}
        <AdminEventOversight />

        {/* User Accounts Management */}
        <section id="accounts" className="table-card">
          <div className="table-header">
            <div>
              <h3>User Accounts & Governance</h3>
              <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
                Manage roles and activation status across all registered platform users.
              </p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>User Profile</th>
                  <th>Email</th>
                  <th>Current Role</th>
                  <th>Account Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong style={{ display: 'block' }}>
                        {[u.firstName, u.lastName].filter(Boolean).join(' ') || 'Unnamed User'}
                      </strong>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        className="form-select"
                        style={{ width: '140px', padding: '6px 10px', fontSize: '13px' }}
                        value={u.role}
                        onChange={(e) => void updateUser(u, { role: e.target.value as UserRecord['role'] })}
                      >
                        <option value="ATTENDEE">Attendee</option>
                        <option value="ORGANIZER">Organizer</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className="form-select"
                        style={{ width: '130px', padding: '6px 10px', fontSize: '13px' }}
                        value={u.status}
                        onChange={(e) => void updateUser(u, { status: e.target.value as UserRecord['status'] })}
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="DEACTIVATED">Deactivated</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Event Categories Taxonomy */}
        <CategoryManager />
      </div>
    </DashboardShell>
  )
}

function AdminEventOversight() {
  const request = useAuthenticatedApi()
  const toast = useToast()
  const [events, setEvents] = useState<ManagedEvent[]>([])
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Cancel Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [targetEvent, setTargetEvent] = useState<ManagedEvent | null>(null)
  const [cancelBusy, setCancelBusy] = useState(false)

  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await request<ManagedEvent[]>({
        method: 'GET',
        url: `/admin/events${status ? `?status=${encodeURIComponent(status)}` : ''}`,
      })
      setEvents(data)
    } catch {
      toast.error('Events Load Error', 'Could not load platform events for oversight.')
    } finally {
      setLoading(false)
    }
  }, [request, status, toast])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  async function handleCancelSubmit(reason: string) {
    if (!targetEvent) return
    setCancelBusy(true)
    try {
      const { data } = await request<{ cancellationNoticesQueued: number }>({
        method: 'PATCH',
        url: `/admin/events/${targetEvent.id}/cancel`,
        data: { reason },
      })
      toast.success(
        'Event Cancelled',
        `“${targetEvent.title}” has been cancelled. ${data.cancellationNoticesQueued} attendee notice(s) queued.`,
      )
      setCancelModalOpen(false)
      setTargetEvent(null)
      await loadEvents()
    } catch {
      toast.error('Cancellation Failed', 'The event could not be cancelled. Refresh and try again.')
    } finally {
      setCancelBusy(false)
    }
  }

  const filteredEvents = events.filter((e) =>
    `${e.title} ${e.city} ${e.organizer.email}`.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <section id="events" className="table-card">
      <div className="table-header" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3>Platform Events Oversight</h3>
          <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
            Monitor, inspect, and perform administrative cancellations across all published events.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <IconSearch style={{ position: 'absolute', left: '10px', top: '10px', width: '16px', height: '16px', color: 'var(--text-muted)' }} />
            <input
              type="search"
              className="form-input"
              style={{ paddingLeft: '34px', width: '220px' }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, city, host…"
            />
          </div>
          <select
            className="form-select"
            style={{ width: '150px' }}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Event Title</th>
              <th>Host / Organizer</th>
              <th>Status</th>
              <th>Location & Date</th>
              <th>Tickets Sold</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>
                  <div className="spinner" style={{ margin: '0 auto 8px' }} />
                  <span className="text-muted">Loading events…</span>
                </td>
              </tr>
            ) : filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No events found matching your search.
                </td>
              </tr>
            ) : (
              filteredEvents.map((e) => (
                <tr key={e.id}>
                  <td><strong>{e.title}</strong></td>
                  <td>
                    <span>{[e.organizer.firstName, e.organizer.lastName].filter(Boolean).join(' ') || e.organizer.email}</span>
                  </td>
                  <td>
                    <span className={`badge ${
                      e.status === 'PUBLISHED' ? 'badge-emerald' : e.status === 'CANCELLED' ? 'badge-rose' : 'badge-slate'
                    }`}>
                      <span className="badge-dot" />
                      {e.status.toLowerCase()}
                    </span>
                  </td>
                  <td>{e.city} · {new Date(e.startAt).toLocaleDateString()}</td>
                  <td>
                    <strong>{e.ticketsSold.toLocaleString()}</strong> sold ({e.ticketsReserved.toLocaleString()} reserved)
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {e.status !== 'CANCELLED' && e.status !== 'COMPLETED' && (
                      <button
                        type="button"
                        className="text-button text-button--destructive"
                        onClick={() => {
                          setTargetEvent(e)
                          setCancelModalOpen(true)
                        }}
                      >
                        Cancel Event
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Accessible Cancel Prompt Modal */}
      <PromptModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleCancelSubmit}
        title={`Cancel “${targetEvent?.title}”?`}
        message="Canceling this event immediately stops ticket purchases and queues automated email notices to all registered attendees."
        label="Reason for cancellation"
        placeholder="e.g., Unforeseen venue closure or scheduling conflict"
        confirmText="Confirm & Queue Notices"
        minLength={5}
        loading={cancelBusy}
      />
    </section>
  )
}

function CategoryManager() {
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
    <section id="categories" className="table-card">
      <div className="table-header">
        <div>
          <h3>Event Categories Taxonomy</h3>
          <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
            Define, rename, or toggle public visibility of event discovery categories.
          </p>
        </div>
      </div>

      <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
        <form onSubmit={createCategory} style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr auto', gap: '14px', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">New Category Name</label>
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
              <th>Name</th>
              <th>Slug</th>
              <th>Description</th>
              <th>Visibility</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '24px' }}>Loading categories…</td>
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
  )
}
