import { useCallback, useEffect, useState } from 'react'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { DashboardShell } from '../analytics/dashboard-shell'
import { useToast } from '../../components/ui/toast'
import { IconSearch } from '../../components/ui/icons'
import { AdminPagination } from './admin-pagination'
import { AdminNoteModal } from './admin-note-modal'

interface UserRecord {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: 'ATTENDEE' | 'ORGANIZER' | 'ADMIN'
  status: 'ACTIVE' | 'DEACTIVATED'
}
interface AuditRecord { id: string; action: string; beforeValue: string | null; afterValue: string | null; reason: string | null; createdAt: string; actor: { email: string; firstName: string | null; lastName: string | null } }
type UserChange = { user: UserRecord; patch: { role?: UserRecord['role']; status?: UserRecord['status'] } }

export function AdminUsersPage() {
  const request = useAuthenticatedApi()
  const toast = useToast()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageData, setPageData] = useState({ total: 0, pageCount: 0 })
  const [auditUser, setAuditUser] = useState<UserRecord | null>(null)
  const [auditRows, setAuditRows] = useState<AuditRecord[]>([])
  const [pendingChange, setPendingChange] = useState<UserChange | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' })
      if (query.trim()) params.set('search', query.trim())
      if (roleFilter) params.set('role', roleFilter)
      if (statusFilter) params.set('status', statusFilter)
      const response = await request<{ items: UserRecord[]; total: number; pageCount: number }>({ method: 'GET', url: `/users?${params}` })
      setUsers(response.data.items)
      setPageData({ total: response.data.total, pageCount: response.data.pageCount })
    } catch {
      toast.error('Load Error', 'Could not load platform users.')
    } finally {
      setLoading(false)
    }
  }, [page, query, request, roleFilter, statusFilter, toast])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  function updateUser(user: UserRecord, patch: { role?: UserRecord['role']; status?: UserRecord['status'] }) { setPendingChange({ user, patch }) }

  async function applyUserChange(reason: string) {
    if (!pendingChange) return
    const { user, patch } = pendingChange
    try {
      const [field, value] = Object.entries(patch)[0]
      await request({ method: 'PATCH', url: `/users/${user.id}/${field}`, data: { [field]: value, reason } })
      toast.success('Account Modified', `${user.email} updated to ${value}.`)
      await loadUsers()
    } catch (error) {
      const message = typeof error === 'object' && error !== null && 'response' in error && typeof error.response === 'object' && error.response !== null && 'data' in error.response && typeof error.response.data === 'object' && error.response.data !== null && 'message' in error.response.data ? String(error.response.data.message) : 'That account modification could not be saved.'
      toast.error('Update Failed', message)
    } finally { await loadUsers() }
  }

  async function showAudit(user: UserRecord) {
    setAuditUser(user)
    try { const { data } = await request<AuditRecord[]>({ method: 'GET', url: `/admin/users/${user.id}/audit-log` }); setAuditRows(data) }
    catch { toast.error('History Unavailable', 'Could not load this account’s admin change history.') }
  }

  useEffect(() => { setPage(1) }, [query, roleFilter, statusFilter])

  return (
    <DashboardShell role="ADMIN" pageTitle="Accounts">
      <section className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ margin: 0 }}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5 [&_h3]:m-0 [&_h3]:text-lg [&_h3]:font-bold" style={{ flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3>User Directory ({pageData.total})</h3>
            <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
              Search accounts and manage roles and access.
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
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                style={{ paddingLeft: '34px', width: '220px' }}
                placeholder="Search name or email…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
              style={{ width: '150px' }}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="ATTENDEE">Attendees</option>
              <option value="ORGANIZER">Organizers</option>
              <option value="ADMIN">Admins</option>
            </select>
            <select className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by account status">
              <option value="">All Statuses</option><option value="ACTIVE">Active</option><option value="DEACTIVATED">Deactivated</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-left [&_th]:border-b [&_th]:border-[var(--border)] [&_th]:bg-slate-50 [&_th]:px-5 [&_th]:py-3.5 [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-[0.5px] [&_th]:text-[var(--text-muted)] [&_th]:uppercase [&_td]:border-b [&_td]:border-[var(--border)] [&_td]:px-5 [&_td]:py-4 [&_td]:text-sm [&_td]:text-[var(--text-main)] [&_td]:align-middle [&_tr:last-child_td]:border-b-0 [&_tr:hover_td]:bg-slate-50">
            <thead>
              <tr>
                <th>User Profile</th>
                <th>Email Address</th>
                <th>Role Assignment</th>
                <th>Account Status</th><th>History</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="h-8 w-8 rounded-full border-[3px] border-[rgba(99,102,241,0.2)] border-t-[var(--primary)] animate-[spin_0.8s_linear_infinite]" style={{ margin: '0 auto 8px' }} />
                    <span className="text-muted">Loading user directory…</span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No users match your search or filter.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
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
                    <td><button onClick={() => void showAudit(u)} className="text-sm font-semibold text-indigo-700 hover:underline">View history</button></td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
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
                        className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
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
        {!loading && <AdminPagination page={page} pageCount={pageData.pageCount} total={pageData.total} onPage={setPage} />}
      </section>
      {auditUser && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuditUser(null) }}><aside role="dialog" aria-modal="true" aria-label="Account admin history" className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="m-0 text-xs font-semibold uppercase text-indigo-700">Account history</p><h2 className="mb-0 mt-1 text-xl font-bold">{auditUser.email}</h2></div><button onClick={() => setAuditUser(null)} className="rounded border px-3 py-1.5 text-sm">Close</button></div><div className="mt-5 divide-y divide-slate-100">{auditRows.length ? auditRows.map((row) => <article key={row.id} className="py-4"><p className="m-0 text-sm font-semibold text-slate-900">{row.action.replaceAll('_', ' ').toLowerCase()} · {row.beforeValue} → {row.afterValue}</p><p className="mb-0 mt-1 text-xs text-slate-500">{[row.actor.firstName, row.actor.lastName].filter(Boolean).join(' ') || row.actor.email} · {new Date(row.createdAt).toLocaleString()}</p>{row.reason && <p className="mb-0 mt-2 text-sm text-slate-600">{row.reason}</p>}</article>) : <p className="text-sm text-slate-500">No admin role or status changes recorded.</p>}</div></aside></div>}
      <AdminNoteModal open={Boolean(pendingChange)} title="Confirm account change" description={`${pendingChange?.user.email} will be updated to ${pendingChange?.patch.role ?? pendingChange?.patch.status}. Record a reason for this change; it will be visible in account history.`} placeholder="Reason for changing this account access" submitLabel="Save change" onClose={() => setPendingChange(null)} onSubmit={applyUserChange} />
    </DashboardShell>
  )
}
