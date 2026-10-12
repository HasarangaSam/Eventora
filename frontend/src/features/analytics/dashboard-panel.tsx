import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { metricCardClass, metricsGridClass, metricHintClass, metricLabelClass, metricValueClass } from '../../components/ui/metric-card-classes'

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
    async function loadDashboard() {
      try {
        const { data } = await request<Payload>({ method: 'GET', url: path })
        if (active) setState({ loading: false, error: null, data })
      } catch {
        if (active) setState({ loading: false, error: 'Dashboard data could not be loaded.', data: null })
      }
    }

    async function loadSalesTrend() {
      try {
        const { data } = await request<{ months: SalesMonth[] }>({ method: 'GET', url: '/organizer/analytics/sales' })
        if (active) setSalesTrend(data.months)
      } catch {
        if (active) setSalesTrend([])
      }
    }

    void loadDashboard()
    if (role === 'ORGANIZER') void loadSalesTrend()

    return () => {
      active = false
    }
  }, [attempt, request, role])

  if (state.loading) {
    return (
      <div className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ padding: '40px', textAlign: 'center' }}>
        <div className="h-8 w-8 rounded-full border-[3px] border-[rgba(99,102,241,0.2)] border-t-[var(--primary)] animate-[spin_0.8s_linear_infinite]" style={{ margin: '0 auto 12px' }} />
        <p className="text-muted">Loading metrics…</p>
      </div>
    )
  }

  if (state.error || !state.data) {
    return (
      <div className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ padding: '32px', textAlign: 'center' }}>
        <p className="text-muted">{state.error ?? 'Analytics data unavailable.'}</p>
        <button type="button" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)] [--button-px:12px] [--button-py:6px] [--button-font-size:13px] [--button-radius:var(--radius-sm)] text-[13px]" onClick={() => setAttempt((v) => v + 1)}>
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
        <div className={metricsGridClass}>
          <div className={metricCardClass}>
            <span className={metricLabelClass}>Active Tickets</span>
            <strong className={metricValueClass}>{Number(data.activeTickets ?? 0).toLocaleString()}</strong>
            <span className={metricHintClass}>Ready for event check-in</span>
          </div>
          <div className={metricCardClass}>
            <span className={metricLabelClass}>Total Registrations</span>
            <strong className={metricValueClass}>{Number(data.registrationCount ?? 0).toLocaleString()}</strong>
            <span className={metricHintClass}>All-time bookings</span>
          </div>
        </div>

        <div className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5 [&_h3]:m-0 [&_h3]:text-lg [&_h3]:font-bold">
            <h3>Recent Event Registrations</h3>
            <Link to="/tickets" className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border-0 bg-transparent px-2 py-1 text-[13px] font-semibold text-[var(--text-button-color,var(--primary))] cursor-pointer transition-[all] duration-150 hover:bg-[var(--text-button-bg,var(--primary-light))] hover:text-[var(--text-button-hover,var(--primary-hover))]">
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
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none capitalize border border-[#a7f3d0] bg-[#ecfdf5] text-[#059669] [--badge-dot-color:#10b981]">
                        <span className="h-[6px] w-[6px] rounded-full bg-[var(--badge-dot-color)]" />
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
      <div className={metricsGridClass}>
        {isOrganizer ? (
          <>
            <div className={metricCardClass}>
              <span className={metricLabelClass}>Published Events</span>
              <strong className={metricValueClass}>{Number(data.eventCount ?? 0).toLocaleString()}</strong>
              <span className={metricHintClass}>Events created</span>
            </div>
            <div className={metricCardClass}>
              <span className={metricLabelClass}>Confirmed Attendees</span>
              <strong className={metricValueClass} style={{ color: 'var(--primary)' }}>
                {Number(data.confirmedRegistrations ?? 0).toLocaleString()}
              </strong>
              <span className={metricHintClass}>Registrations completed</span>
            </div>
            <div className={metricCardClass}>
              <span className={metricLabelClass}>Tickets Issued</span>
              <strong className={metricValueClass}>{Number(data.ticketsSold ?? 0).toLocaleString()}</strong>
              <span className={metricHintClass}>Digital passes generated</span>
            </div>
          </>
        ) : (
          <>
            <div className={metricCardClass}>
              <span className={metricLabelClass}>Total Users</span>
              <strong className={metricValueClass}>{Number(data.totalUsers ?? 0).toLocaleString()}</strong>
              <span className={metricHintClass}>Registered accounts</span>
            </div>
            <div className={metricCardClass}>
              <span className={metricLabelClass}>Active Users</span>
              <strong className={metricValueClass} style={{ color: 'var(--success)' }}>
                {Number(data.activeUsers ?? 0).toLocaleString()}
              </strong>
              <span className={metricHintClass}>Active accounts</span>
            </div>
            <div className={metricCardClass}>
              <span className={metricLabelClass}>Pending Applications</span>
              <strong className={metricValueClass} style={{ color: 'var(--warning)' }}>
                {Number(data.pendingApplications ?? 0).toLocaleString()}
              </strong>
              <span className={metricHintClass}>Awaiting review</span>
            </div>
            <div className={metricCardClass}>
              <span className={metricLabelClass}>Platform Registrations</span>
              <strong className={metricValueClass}>{Number(data.registrationCount ?? 0).toLocaleString()}</strong>
              <span className={metricHintClass}>Total volume</span>
            </div>
          </>
        )}
      </div>

      {/* Analytics Insights Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left Column: Distribution or Status */}
        <div className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ margin: 0, padding: '24px' }}>
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

        {/* Right Column: Confirmed Ticket Sales */}
        <div className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ margin: 0, padding: '24px' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '16px' }}>Confirmed Ticket Sales</h4>
          {gross.length ? (
            gross.map((item) => (
              <div key={item.currency} style={{ marginBottom: '16px' }}>
                <span className="text-muted" style={{ fontSize: '12px', textTransform: 'uppercase' }}>
                  {item.currency} Confirmed Revenue
                </span>
                <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.5px' }}>
                  {item.currency} {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted">No confirmed payments yet.</p>
          )}
          <p className="text-muted" style={{ fontSize: '12px', margin: '8px 0 0' }}>
            Totals include payments confirmed by PayHere, before fees.
          </p>
        </div>
      </div>

      {isOrganizer && salesTrend.length > 0 && (
        <div className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ padding: '24px' }}>
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
