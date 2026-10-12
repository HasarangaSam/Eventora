import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'

type Role = 'ATTENDEE' | 'ORGANIZER' | 'ADMIN'
type Payload = Record<string, unknown>
type SalesMonth = { month: string; grossSales: Array<{ currency: string; amount: string; payments: number }> }

export function DashboardPanel({ role }: { role: Role }) {
  const request = useAuthenticatedApi()
  const [attempt, setAttempt] = useState(0)
  const [salesTrend, setSalesTrend] = useState<SalesMonth[]>([])
  const [state, setState] = useState<{ loading: boolean; error: string | null; data: Payload | null }>({
    loading: true,
    error: null,
    data: null,
  })

  useEffect(() => {
    let active = true
    const path =
      role === 'ADMIN' ? '/admin/dashboard' : role === 'ORGANIZER' ? '/organizer/dashboard' : '/attendee/dashboard'
    void request<Payload>({ method: 'GET', url: path })
      .then(({ data }) => {
        if (active) setState({ loading: false, error: null, data })
      })
      .catch(() => {
        if (active) setState({ loading: false, error: 'Dashboard data could not be loaded.', data: null })
      })

    if (role === 'ORGANIZER')
      void request<{ months: SalesMonth[] }>({ method: 'GET', url: '/organizer/analytics/sales' })
        .then(({ data }) => {
          if (active) setSalesTrend(data.months)
        })
        .catch(() => {
          if (active) setSalesTrend([])
        })

    return () => {
      active = false
    }
  }, [attempt, request, role])

  if (state.loading) {
    return (
      <div className="table-card" style={{ padding: '40px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        <p className="text-muted">Loading metrics…</p>
      </div>
    )
  }

  if (state.error || !state.data) {
    return (
      <div className="table-card" style={{ padding: '32px', textAlign: 'center' }}>
        <p className="text-muted">{state.error ?? 'Analytics data unavailable.'}</p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAttempt((v) => v + 1)}>
          Retry
        </button>
      </div>
    )
  }

  const data = state.data

  if (role === 'ATTENDEE') {
    const registrations = Array.isArray(data.registrations) ? (data.registrations as Array<Record<string, unknown>>) : []
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="metrics-grid">
          <div className="metric-card">
            <span className="metric-label">Active Tickets</span>
            <strong className="metric-value">{Number(data.activeTickets ?? 0).toLocaleString()}</strong>
            <span className="metric-hint">Ready for event check-in</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Total Registrations</span>
            <strong className="metric-value">{Number(data.registrationCount ?? 0).toLocaleString()}</strong>
            <span className="metric-hint">All-time bookings</span>
          </div>
        </div>

        <div className="table-card">
          <div className="table-header">
            <h3>Recent Event Registrations</h3>
            <Link to="/tickets" className="text-button">
              View Digital Wallet →
            </Link>
          </div>
          <div style={{ padding: '16px' }}>
            {registrations.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {registrations.map((reg) => {
                  const ev = reg.event as Record<string, unknown>
                  return (
                    <div
                      key={String(reg.id)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '14px 18px',
                        background: '#f8fafc',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '15px' }}>{String(ev?.title ?? 'Event')}</strong>
                        <div className="text-muted" style={{ fontSize: '13px' }}>
                          {new Date(String(ev?.startAt)).toLocaleDateString()} · {String(ev?.city ?? '')}
                        </div>
                      </div>
                      <span className="badge badge-emerald">
                        <span className="badge-dot" />
                        {String(reg.status).toLowerCase()}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-muted" style={{ margin: 0, padding: '16px', textAlign: 'center' }}>
                You have not registered for any events yet.
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  const isOrganizer = role === 'ORGANIZER'
  const statuses = (data.eventsByStatus ?? data.paymentsByStatus) as Record<string, number> | undefined
  const gross = Array.isArray(data.grossSales) ? (data.grossSales as Array<{ currency: string; amount: string }>) : []
  const users = data.usersByRole as Record<string, number> | undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Metrics Grid */}
      <div className="metrics-grid">
        {isOrganizer ? (
          <>
            <div className="metric-card">
              <span className="metric-label">Published Events</span>
              <strong className="metric-value">{Number(data.eventCount ?? 0).toLocaleString()}</strong>
              <span className="metric-hint">Events created</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Confirmed Attendees</span>
              <strong className="metric-value" style={{ color: 'var(--primary)' }}>
                {Number(data.confirmedRegistrations ?? 0).toLocaleString()}
              </strong>
              <span className="metric-hint">Registrations completed</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Tickets Issued</span>
              <strong className="metric-value">{Number(data.ticketsSold ?? 0).toLocaleString()}</strong>
              <span className="metric-hint">Digital passes generated</span>
            </div>
          </>
        ) : (
          <>
            <div className="metric-card">
              <span className="metric-label">Total Users</span>
              <strong className="metric-value">{Number(data.totalUsers ?? 0).toLocaleString()}</strong>
              <span className="metric-hint">Registered accounts</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Active Users</span>
              <strong className="metric-value" style={{ color: 'var(--success)' }}>
                {Number(data.activeUsers ?? 0).toLocaleString()}
              </strong>
              <span className="metric-hint">Active accounts</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Pending Applications</span>
              <strong className="metric-value" style={{ color: 'var(--warning)' }}>
                {Number(data.pendingApplications ?? 0).toLocaleString()}
              </strong>
              <span className="metric-hint">Awaiting review</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Platform Registrations</span>
              <strong className="metric-value">{Number(data.registrationCount ?? 0).toLocaleString()}</strong>
              <span className="metric-hint">Total volume</span>
            </div>
          </>
        )}
      </div>

      {/* Analytics Insights Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left Column: Distribution or Status */}
        <div className="table-card" style={{ margin: 0, padding: '24px' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '16px' }}>
            {isOrganizer ? 'Events Breakdown by Status' : 'User Base by Role'}
          </h4>
          {isOrganizer ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {statuses && Object.keys(statuses).length ? (
                Object.entries(statuses).map(([key, val]) => (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: '#f8fafc',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '14px',
                    }}
                  >
                    <span style={{ textTransform: 'capitalize' }}>{key.replace(/_/g, ' ').toLowerCase()}</span>
                    <strong>{val}</strong>
                  </div>
                ))
              ) : (
                <p className="text-muted">No activity recorded yet.</p>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {users &&
                Object.entries(users).map(([r, count]) => (
                  <div key={r}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                      <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{r.toLowerCase()}</span>
                      <strong>{count.toLocaleString()}</strong>
                    </div>
                    <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          background: r === 'ADMIN' ? 'var(--danger)' : r === 'ORGANIZER' ? 'var(--primary)' : 'var(--success)',
                          width: `${Math.min(100, (count / (Number(data.totalUsers) || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Right Column: Gross Sales Volume */}
        <div className="table-card" style={{ margin: 0, padding: '24px' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '16px' }}>Verified Gross Sales</h4>
          {gross.length ? (
            gross.map((item) => (
              <div key={item.currency} style={{ marginBottom: '16px' }}>
                <span className="text-muted" style={{ fontSize: '12px', textTransform: 'uppercase' }}>
                  {item.currency} Verified Revenue
                </span>
                <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.5px' }}>
                  {item.currency} {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted">No verified transactions yet.</p>
          )}
          <p className="text-muted" style={{ fontSize: '12px', margin: '8px 0 0' }}>
            Gross sales reflect verified payments confirmed via PayHere webhook notifications.
          </p>
        </div>
      </div>

      {isOrganizer && salesTrend.length > 0 && (
        <div className="table-card" style={{ padding: '24px' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '16px' }}>6-Month Revenue Trend</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
            {salesTrend.map((m) => (
              <div
                key={m.month}
                style={{
                  padding: '12px',
                  background: '#f8fafc',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                  border: '1px solid var(--border)',
                }}
              >
                <span className="text-muted" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                  {m.month}
                </span>
                <strong style={{ fontSize: '15px', color: 'var(--primary)' }}>
                  {m.grossSales.map((g) => `${g.currency} ${Number(g.amount).toLocaleString()}`).join(' · ') || '0'}
                </strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
