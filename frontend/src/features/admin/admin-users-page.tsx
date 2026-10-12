import { useCallback, useEffect, useState } from 'react'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { DashboardShell } from '../analytics/dashboard-shell'
import { useToast } from '../../components/ui/toast'
import { IconSearch } from '../../components/ui/icons'

interface UserRecord {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: 'ATTENDEE' | 'ORGANIZER' | 'ADMIN'
  status: 'ACTIVE' | 'DEACTIVATED'
}

export function AdminUsersPage() {
  const request = useAuthenticatedApi()
  const toast = useToast()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const response = await request<UserRecord[]>({ method: 'GET', url: '/users' })
      setUsers(response.data)
    } catch {
      toast.error('Load Error', 'Could not load platform users.')
    } finally {
      setLoading(false)
    }
  }, [request, toast])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  async function updateUser(user: UserRecord, patch: { role?: UserRecord['role']; status?: UserRecord['status'] }) {
    try {
      const [field, value] = Object.entries(patch)[0]
      await request({ method: 'PATCH', url: `/users/${user.id}/${field}`, data: { [field]: value } })
      toast.success('Account Modified', `${user.email} updated to ${value}.`)
      await loadUsers()
    } catch {
      toast.error('Update Failed', 'That account modification could not be saved. At least one active admin must remain.')
    }
  }

  const filtered = users.filter((u) => {
    const matchesQuery = `${u.firstName ?? ''} ${u.lastName ?? ''} ${u.email}`
      .toLowerCase()
      .includes(query.toLowerCase())
    const matchesRole = !roleFilter || u.role === roleFilter
    return matchesQuery && matchesRole
  })

  return (
    <DashboardShell role="ADMIN" pageTitle="User Accounts & Role Governance">
      <section className="table-card" style={{ margin: 0 }}>
        <div className="table-header" style={{ flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3>User Directory ({users.length})</h3>
            <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
              Elevate user privileges, verify active organizers, and manage platform account statuses.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <IconSearch
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '10px',
                  width: '16px',
                  height: '16px',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="search"
                className="form-input"
                style={{ paddingLeft: '34px', width: '220px' }}
                placeholder="Search name or email…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              className="form-select"
              style={{ width: '150px' }}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="ATTENDEE">Attendees</option>
              <option value="ORGANIZER">Organizers</option>
              <option value="ADMIN">Admins</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>User Profile</th>
                <th>Email Address</th>
                <th>Role Assignment</th>
                <th>Account Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="spinner" style={{ margin: '0 auto 8px' }} />
                    <span className="text-muted">Loading user directory…</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No users match your search or filter.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: u.role === 'ADMIN' ? '#fee2e2' : u.role === 'ORGANIZER' ? '#eef2ff' : '#f1f5f9',
                            color: u.role === 'ADMIN' ? '#dc2626' : u.role === 'ORGANIZER' ? '#4f46e5' : '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '13px',
                          }}
                        >
                          {(u.firstName?.[0] || u.email[0]).toUpperCase()}
                        </div>
                        <div>
                          <strong style={{ display: 'block', fontSize: '14px' }}>
                            {[u.firstName, u.lastName].filter(Boolean).join(' ') || 'Unnamed User'}
                          </strong>
                        </div>
                      </div>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  )
}
