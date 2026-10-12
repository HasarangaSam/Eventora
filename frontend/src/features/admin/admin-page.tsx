import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { DashboardShell } from '../analytics/dashboard-shell'

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
interface CategoryRecord { id: string; name: string; slug: string; description: string | null; isActive: boolean }

export function AdminPage() {
  const request = useAuthenticatedApi()
  const [applications, setApplications] = useState<Application[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [applicationResponse, userResponse] = await Promise.all([
        request<Application[]>({ method: 'GET', url: '/organizer-applications?status=PENDING' }),
        request<UserRecord[]>({ method: 'GET', url: '/users' }),
      ])
      setApplications(applicationResponse.data)
      setUsers(userResponse.data)
      setMessage('')
    } catch {
      setMessage('Admin data is unavailable. Confirm that this account has administrator access, then retry.')
    } finally {
      setLoading(false)
    }
  }, [request])

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
        if (active) setMessage('Admin data is unavailable. Confirm that this account has administrator access, then retry.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [request])

  async function decide(id: string, status: 'APPROVED' | 'REJECTED') {
    try {
      await request({ method: 'PATCH', url: `/organizer-applications/${id}/decision`, data: { status } })
      await refresh()
    } catch {
      setMessage('The application decision could not be saved. Refresh and try again.')
    }
  }

  async function updateUser(user: UserRecord, patch: { role?: UserRecord['role']; status?: UserRecord['status'] }) {
    try {
      const [field, value] = Object.entries(patch)[0]
      await request({ method: 'PATCH', url: `/users/${user.id}/${field}`, data: { [field]: value } })
      await refresh()
    } catch {
      setMessage('That account change could not be saved. At least one active administrator must remain.')
    }
  }

  return <DashboardShell role="ADMIN"><main className="admin-page">
    <span className="eyebrow">Eventora operations</span>
    <h1>Administrator workspace</h1>
    <Link className="account-home-link" to="/account">Back to account</Link>
    {message && <p className="account-error" role="alert">{message}</p>}
    {loading ? <p aria-live="polite">Loading admin workspace…</p> : <>
      <section className="admin-section"><h2>Organizer applications</h2>
        {applications.length === 0 ? <p>No pending applications.</p> : applications.map((application) => <article className="admin-application" key={application.id}>
          <div><strong>{application.organizationName}</strong><span>{application.applicant.firstName} {application.applicant.lastName} · {application.applicant.email}</span></div>
          <dl className="application-review-grid">
            <dt>Applicant contact</dt><dd>{application.contactName ?? ([application.applicant.firstName, application.applicant.lastName].filter(Boolean).join(' ') || 'Not provided')} · {application.applicantEmail ?? application.applicant.email} · {application.contactPhone ?? 'No phone provided'}</dd>
            <dt>Organizer type</dt><dd>{application.organizerType?.replaceAll('_', ' ').toLowerCase() ?? 'Legacy application'}</dd>
            <dt>Location</dt><dd>{[application.city, application.country].filter(Boolean).join(', ') || 'Not provided'}</dd>
            <dt>Website / social</dt><dd>{application.websiteUrl ? <a href={application.websiteUrl} target="_blank" rel="noreferrer">{application.websiteUrl}</a> : 'Not provided'}</dd>
            <dt>Event categories</dt><dd>{application.eventCategories.map(({ category }) => category.name).join(', ') || 'Not provided'}</dd>
            <dt>Experience</dt><dd>{application.experience ?? 'Not provided'}</dd>
            <dt>Expected frequency</dt><dd>{application.eventFrequency?.replaceAll('_', ' ').toLowerCase() ?? 'Not provided'}</dd>
            <dt>Typical attendance</dt><dd>{application.expectedAttendance?.toLocaleString() ?? 'Not provided'}</dd>
            <dt>Agreements</dt><dd>{application.accuracyConfirmed && application.rulesAccepted ? `Accuracy and rules accepted (${application.rulesVersion ?? 'version not recorded'}${application.agreedAt ? ` · ${new Date(application.agreedAt).toLocaleString()}` : ''})` : 'Legacy application; no recorded agreement'}</dd>
          </dl>
          <p>{application.description}</p>
          <small>Submitted {new Date(application.submittedAt).toLocaleString()}</small>
          <div className="admin-actions">
            <button className="button" onClick={() => void decide(application.id, 'APPROVED')} type="button">Approve</button>
            <button className="text-button" onClick={() => void decide(application.id, 'REJECTED')} type="button">Reject</button>
          </div>
        </article>)}
      </section>
      <section className="admin-section"><h2>Accounts</h2>
        <div className="user-table" role="table" aria-label="Eventora accounts">
          {users.map((user) => <div className="user-row" role="row" key={user.id}>
            <span role="cell">{user.firstName} {user.lastName}<small>{user.email}</small></span>
            <label>Role<select aria-label={`Role for ${user.email}`} value={user.role} onChange={(event) => void updateUser(user, { role: event.target.value as UserRecord['role'] })}>
              <option value="ATTENDEE">Attendee</option><option value="ORGANIZER">Organizer</option><option value="ADMIN">Admin</option>
            </select></label>
            <label>Status<select aria-label={`Status for ${user.email}`} value={user.status} onChange={(event) => void updateUser(user, { status: event.target.value as UserRecord['status'] })}>
              <option value="ACTIVE">Active</option><option value="DEACTIVATED">Deactivated</option>
            </select></label>
          </div>)}
        </div>
      </section>
      <CategoryManager />
    </>}
  </main></DashboardShell>
}

function CategoryManager() {
  const request = useAuthenticatedApi()
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const { data } = await request<CategoryRecord[]>({ method: 'GET', url: '/categories/admin/list' })
      setCategories(data)
    } catch {
      setMessage('Category management is unavailable.')
    } finally {
      setLoading(false)
    }
  }, [request])

  useEffect(() => {
    let active = true
    void request<CategoryRecord[]>({ method: 'GET', url: '/categories/admin/list' })
      .then(({ data }) => { if (active) setCategories(data) })
      .catch(() => { if (active) setMessage('Category management is unavailable.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [request])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await request({ method: 'POST', url: '/categories', data: { name, description } })
      setName('')
      setDescription('')
      setMessage('Category created.')
      await refresh()
    } catch {
      setMessage('Category could not be created. Check for a duplicate name or slug.')
    }
  }

  async function update(category: CategoryRecord) {
    try {
      await request({ method: 'PATCH', url: `/categories/${category.id}`, data: category })
      setMessage('Category saved.')
      await refresh()
    } catch {
      setMessage('Category could not be saved. Check the name and slug.')
    }
  }

  async function remove(category: CategoryRecord) {
    if (!window.confirm(`Delete “${category.name}”? Categories referenced by events must be deactivated instead.`)) return
    try {
      await request({ method: 'DELETE', url: `/categories/${category.id}` })
      setMessage('Category deleted.')
      await refresh()
    } catch {
      setMessage('That category is in use. Deactivate it to preserve event history.')
    }
  }

  return <section className="admin-section"><h2>Event categories</h2>
    {message && <p className="inline-notice" role="status">{message}</p>}
    <form className="category-form" onSubmit={create}>
      <label>New category<input required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Description<textarea maxLength={2000} rows={1} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <button className="button" type="submit">Add category</button>
    </form>
    {loading ? <p>Loading categories…</p> : categories.map((category) => <div className="category-admin-row" key={category.id}>
      <label className="visually-hidden" htmlFor={`category-name-${category.id}`}>Category name</label>
      <input id={`category-name-${category.id}`} aria-label="Category name" value={category.name} onChange={(event) => setCategories(categories.map((item) => item.id === category.id ? { ...item, name: event.target.value } : item))} />
      <input aria-label="Category slug" value={category.slug} onChange={(event) => setCategories(categories.map((item) => item.id === category.id ? { ...item, slug: event.target.value } : item))} />
      <input aria-label="Category description" value={category.description ?? ''} onChange={(event) => setCategories(categories.map((item) => item.id === category.id ? { ...item, description: event.target.value } : item))} />
      <button className="text-button" onClick={() => void update(category)} type="button">Save</button>
      <button className="text-button" onClick={() => void update({ ...category, isActive: !category.isActive })} type="button">{category.isActive ? 'Disable' : 'Enable'}</button>
      <small>{category.isActive ? 'Public' : 'Hidden'}</small>
      <button className="text-button" onClick={() => void remove(category)} type="button">Delete</button>
    </div>)}
  </section>
}
