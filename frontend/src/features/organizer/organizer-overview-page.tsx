import React, { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { DashboardShell } from '../analytics/dashboard-shell'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { IconCalendar, IconCamera, IconTicket, IconSparkles } from '../../components/ui/icons'

type Payload = Record<string, unknown>
type SalesMonth = { month: string; grossSales: { currency: string; amount: string; payments: number }[] }

const STATUS_COLORS: Record<string, string> = { PUBLISHED: '#10b981', DRAFT: '#94a3b8', CANCELLED: '#ef4444', COMPLETED: '#6366f1' }

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
      <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '13px', color: '#64748b' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ margin: '4px 0', fontSize: '14px', fontWeight: 600, color: p.color }}>
          {p.name}: <strong>{p.value.toLocaleString()}</strong>
        </p>
      ))}
    </div>
  )
}

function PieTip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { fill: string } }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
      <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: p.payload.fill }}>{p.name}</p>
      <p style={{ margin: '4px 0 0', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{p.value.toLocaleString()}</p>
    </div>
  )
}

export function OrganizerOverviewPage() {
  const request = useAuthenticatedApi()
  const [data, setData] = useState<Payload | null>(null)
  const [salesTrend, setSalesTrend] = useState<SalesMonth[]>([])
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      request<Payload>({ method: 'GET', url: '/organizer/dashboard' }),
      request<{ months: SalesMonth[] }>({ method: 'GET', url: '/organizer/analytics/sales' }),
    ])
      .then(([{ data: d }, { data: s }]) => {
        if (active) { setData(d); setSalesTrend(s.months); setLoading(false) }
      })
      .catch(() => { if (active) { setData(null); setLoading(false) } })
    return () => { active = false }
  }, [attempt, request])

  const eventCount = Number(data?.eventCount ?? 0)
  const confirmedRegs = Number(data?.confirmedRegistrations ?? 0)
  const ticketsSold = Number(data?.ticketsSold ?? 0)
  const gross = Array.isArray(data?.grossSales) ? (data!.grossSales as { currency: string; amount: string }[]) : []
  const totalRevenue = gross.reduce((s, g) => s + Number(g.amount), 0)
  const eventsByStatus = (data?.eventsByStatus ?? {}) as Record<string, number>
  const statusData = Object.entries(eventsByStatus).map(([name, value]) => ({ name, value }))

  // Revenue trend chart data
  const revenueData = salesTrend.map((m) => ({
    month: m.month,
    revenue: m.grossSales.reduce((s, g) => s + Number(g.amount), 0),
    tickets: m.grossSales.reduce((s, g) => s + g.payments, 0),
  }))

  const kpis = [
    { label: 'Published Events', value: eventCount.toLocaleString(), hint: 'Events created', color: '#6366f1', bg: '#eef2ff', icon: <IconCalendar /> },
    { label: 'Confirmed Attendees', value: confirmedRegs.toLocaleString(), hint: 'Registrations completed', color: '#10b981', bg: '#ecfdf5', icon: <IconCamera /> },
    { label: 'Tickets Issued', value: ticketsSold.toLocaleString(), hint: 'Digital passes generated', color: '#f59e0b', bg: '#fffbeb', icon: <IconTicket /> },
    { label: 'Gross Revenue', value: gross.length ? `${gross[0].currency} ${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—', hint: 'Verified payments', color: '#ec4899', bg: '#fdf2f8', icon: <IconSparkles /> },
  ]

  return (
    <DashboardShell role="ORGANIZER" pageTitle="Organizer Overview & Analytics">
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', flexDirection: 'column', gap: '16px' }}>
          <div className="spinner" style={{ width: '40px', height: '40px' }} />
          <p className="text-muted">Loading your analytics…</p>
        </div>
      ) : !data ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p className="text-muted" style={{ marginBottom: '16px' }}>Analytics data could not be loaded.</p>
          <button type="button" className="btn btn-secondary" onClick={() => setAttempt(v => v + 1)}>Retry</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

          {/* KPI Row */}
          <div className="admin-kpi-grid">
            {kpis.map((k) => (
              <div key={k.label} className="admin-kpi-card" style={{ borderTop: `3px solid ${k.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="metric-label">{k.label}</span>
                    <strong style={{ display: 'block', marginTop: '6px', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px', color: k.color }}>{k.value}</strong>
                    <span className="metric-hint">{k.hint}</span>
                  </div>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: k.bg, color: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {k.icon}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Revenue Trend Chart */}
          {revenueData.length > 0 && (
            <div className="analytics-card">
              <h3 className="analytics-card-title" style={{ marginBottom: '4px' }}>Revenue & Ticket Sales Trend</h3>
              <p className="analytics-card-subtitle" style={{ marginBottom: '20px' }}>Gross revenue and ticket volume across recent months</p>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ticketsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '13px', paddingTop: '16px' }} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#revenueGrad)" dot={false} activeDot={{ r: 5, fill: '#10b981' }} />
                  <Area type="monotone" dataKey="tickets" name="Tickets" stroke="#6366f1" strokeWidth={2.5} fill="url(#ticketsGrad)" dot={false} activeDot={{ r: 5, fill: '#6366f1' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Events Status + Quick Nav */}
          <div style={{ display: 'grid', gridTemplateColumns: statusData.length > 0 ? '1fr 1fr' : '1fr', gap: '24px' }}>
            {/* Events by Status */}
            {statusData.length > 0 && (
              <div className="analytics-card">
                <h3 className="analytics-card-title" style={{ marginBottom: '4px' }}>Events by Status</h3>
                <p className="analytics-card-subtitle" style={{ marginBottom: '20px' }}>Your events portfolio breakdown</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                        {statusData.map((e) => <Cell key={e.name} fill={STATUS_COLORS[e.name] ?? '#94a3b8'} stroke="none" />)}
                      </Pie>
                      <Tooltip content={<PieTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {statusData.map((e) => (
                      <div key={e.name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 600, color: '#0f172a' }}>
                            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: STATUS_COLORS[e.name] ?? '#94a3b8', display: 'inline-block', flexShrink: 0 }} />
                            {e.name.charAt(0) + e.name.slice(1).toLowerCase()}
                          </span>
                          <strong style={{ color: STATUS_COLORS[e.name] ?? '#94a3b8' }}>{e.value}</strong>
                        </div>
                        <div style={{ height: '5px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: STATUS_COLORS[e.name] ?? '#94a3b8', width: `${eventCount ? Math.min(100, (e.value / eventCount) * 100) : 0}%`, borderRadius: '3px' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Nav */}
            <div className="analytics-card">
              <h3 className="analytics-card-title" style={{ marginBottom: '20px' }}>Quick Access</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { to: '/organizer/events', label: 'Events Studio', sub: 'Create & manage events', color: '#6366f1', bg: '#eef2ff', icon: <IconCalendar /> },
                  { to: '/organizer/sales', label: 'Sales & Revenue', sub: 'Track revenue & tickets', color: '#10b981', bg: '#ecfdf5', icon: <IconTicket /> },
                  { to: '/organizer/checkin', label: 'Door Check-in', sub: 'QR scan attendees', color: '#f59e0b', bg: '#fffbeb', icon: <IconCamera /> },
                  { to: '/organizer/profile', label: 'Organizer Profile', sub: 'Your public info', color: '#ec4899', bg: '#fdf2f8', icon: <IconSparkles /> },
                ].map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="quick-nav-link"
                    style={{ '--link-color': item.color, '--link-bg': item.bg } as React.CSSProperties}
                  >
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: item.bg, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {item.icon}
                    </div>
                    <div>
                      <strong style={{ display: 'block', fontSize: '14px', color: '#0f172a' }}>{item.label}</strong>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>{item.sub}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Revenue Bar Chart (monthly breakdown) */}
          {revenueData.length > 0 && (
            <div className="analytics-card">
              <h3 className="analytics-card-title" style={{ marginBottom: '4px' }}>Monthly Revenue Breakdown</h3>
              <p className="analytics-card-subtitle" style={{ marginBottom: '20px' }}>Gross revenue per month in absolute terms</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={revenueData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

        </div>
      )}
    </DashboardShell>
  )
}
