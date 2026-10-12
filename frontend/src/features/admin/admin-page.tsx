import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'

interface Application {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  organizationName: string
  description: string
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

  return <main className="admin-page">
    <span className="eyebrow">Eventora operations</span>
    <h1>Administrator workspace</h1>
    <Link className="account-home-link" to="/account">Back to account</Link>
    {message && <p className="account-error" role="alert">{message}</p>}
    {loading ? <p aria-live="polite">Loading admin workspace…</p> : <>
      <section className="admin-section"><h2>Organizer applications</h2>
        {applications.length === 0 ? <p>No pending applications.</p> : applications.map((application) => <article className="admin-application" key={application.id}>
          <div><strong>{application.organizationName}</strong><span>{application.applicant.firstName} {application.applicant.lastName} · {application.applicant.email}</span></div>
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
    </>}
  </main>
}
