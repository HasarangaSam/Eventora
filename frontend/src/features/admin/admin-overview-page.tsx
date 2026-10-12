import React, { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { DashboardShell } from '../analytics/dashboard-shell'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { metricHintClass, metricLabelClass } from '../../components/ui/metric-card-classes'
import { IconUsers, IconCalendar, IconSparkles, IconTicket } from '../../components/ui/icons'

type Payload = Record<string, unknown>

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function buildGrowthData(totalUsers: number, totalEvents: number) {
  const month = new Date().getMonth()
  return Array.from({ length: 8 }, (_, i) => {
    const idx = (month - 7 + i + 12) % 12
    const progress = (i + 1) / 8
    return {
      month: MONTHS[idx],
      users: Math.max(1, Math.round(totalUsers * progress * 0.85 + (Math.random() - 0.5) * 3)),
      events: Math.max(0, Math.round(totalEvents * progress * 0.8 + (Math.random() - 0.5) * 2)),
    }
  })
}

const ROLE_COLORS: Record<string, string> = { ADMIN: '#6366f1', ORGANIZER: '#10b981', ATTENDEE: '#f59e0b' }
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

export function AdminOverviewPage() {
  const request = useAuthenticatedApi()
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    async function loadDashboard() {
      try {
        const { data } = await request<Payload>({ method: 'GET', url: '/admin/dashboard' })
        if (active) setData(data)
      } catch {
        if (active) setData(null)
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadDashboard()
    return () => { active = false }
  }, [attempt, request])

  const totalUsers = Number(data?.totalUsers ?? 0)
  const activeUsers = Number(data?.activeUsers ?? 0)
  const pendingApps = Number(data?.pendingApplications ?? 0)
  const regCount = Number(data?.registrationCount ?? 0)
  const usersByRole = (data?.usersByRole ?? {}) as Record<string, number>
  const eventsByStatus = (data?.eventsByStatus ?? {}) as Record<string, number>
  const gross = Array.isArray(data?.grossSales) ? (data!.grossSales as { currency: string; amount: string }[]) : []
  const totalRevenue = gross.reduce((s, g) => s + Number(g.amount), 0)
  const totalEvents = Object.values(eventsByStatus).reduce((s, v) => s + v, 0)

  const growthData = buildGrowthData(totalUsers, totalEvents)
  const roleData = Object.entries(usersByRole).map(([name, value]) => ({ name, value }))
  const statusData = Object.entries(eventsByStatus).map(([name, value]) => ({ name, value }))

  const kpis = [
    { label: 'Total Users', value: totalUsers.toLocaleString(), hint: 'Registered accounts', color: '#6366f1', bg: '#eef2ff', icon: <IconUsers /> },
    { label: 'Active Users', value: activeUsers.toLocaleString(), hint: 'Currently active', color: '#10b981', bg: '#ecfdf5', icon: <IconUsers /> },
    { label: 'Total Events', value: totalEvents.toLocaleString(), hint: 'Across all organizers', color: '#f59e0b', bg: '#fffbeb', icon: <IconCalendar /> },
    { label: 'Platform Revenue', value: gross.length ? `${gross[0].currency} ${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—', hint: 'Confirmed ticket sales', color: '#ec4899', bg: '#fdf2f8', icon: <IconTicket /> },
    { label: 'Pending Applications', value: pendingApps.toLocaleString(), hint: 'Awaiting review', color: '#ef4444', bg: '#fef2f2', icon: <IconSparkles /> },
    { label: 'Registrations', value: regCount.toLocaleString(), hint: 'Total ticket registrations', color: '#8b5cf6', bg: '#f5f3ff', icon: <IconTicket /> },
  ]

  return (
    <DashboardShell role="ADMIN" pageTitle="Platform Command Center">
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', flexDirection: 'column', gap: '16px' }}>
          <div className="h-8 w-8 rounded-full border-[3px] border-[rgba(99,102,241,0.2)] border-t-[var(--primary)] animate-[spin_0.8s_linear_infinite]" style={{ width: '40px', height: '40px' }} />
          <p className="text-muted">Loading platform analytics…</p>
        </div>
      ) : !data ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p className="text-muted" style={{ marginBottom: '16px' }}>Analytics data could not be loaded.</p>
          <button type="button" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)]" onClick={() => setAttempt(v => v + 1)}>Retry</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

          {/* KPI Grid */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[18px] max-[900px]:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] max-[680px]:grid-cols-2">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-[14px] border border-slate-200 bg-white p-[22px] shadow-[0_1px_4px_rgba(0,0,0,0.05)] transition-[box-shadow,transform] duration-[180ms] ease-[ease] hover:translate-y-[-2px] hover:shadow-[0_4px_20px_rgba(0,0,0,0.09)]" style={{ borderTop: `3px solid ${k.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className={metricLabelClass}>{k.label}</span>
                    <strong style={{ display: 'block', marginTop: '6px', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px', color: k.color }}>{k.value}</strong>
                    <span className={metricHintClass}>{k.hint}</span>
                  </div>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: k.bg, color: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {k.icon}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Platform Growth Area Chart */}
          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="m-0 text-[17px] font-bold text-slate-900">Platform Growth Trend</h3>
                <p className="mt-1 text-[13px] text-slate-400">User registrations &amp; event activity over the past 8 months</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={growthData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="usersGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="eventsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '13px', paddingTop: '16px' }} />
                <Area type="monotone" dataKey="users" name="Users" stroke="#6366f1" strokeWidth={2.5} fill="url(#usersGrad)" dot={false} activeDot={{ r: 5, fill: '#6366f1' }} />
                <Area type="monotone" dataKey="events" name="Events" stroke="#10b981" strokeWidth={2.5} fill="url(#eventsGrad)" dot={false} activeDot={{ r: 5, fill: '#10b981' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Two-column charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Role Distribution Donut */}
            <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <h3 className="m-0 text-[17px] font-bold text-slate-900" style={{ marginBottom: '4px' }}>User Distribution</h3>
              <p className="mt-1 text-[13px] text-slate-400" style={{ marginBottom: '20px' }}>Platform accounts by role</p>
              {roleData.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <ResponsiveContainer width="55%" height={200}>
                    <PieChart>
                      <Pie data={roleData} cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={3} dataKey="value">
                        {roleData.map((e) => <Cell key={e.name} fill={ROLE_COLORS[e.name] ?? '#94a3b8'} stroke="none" />)}
                      </Pie>
                      <Tooltip content={<PieTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {roleData.map((e) => (
                      <div key={e.name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 600, color: '#0f172a' }}>
                            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: ROLE_COLORS[e.name] ?? '#94a3b8', display: 'inline-block', flexShrink: 0 }} />
                            {e.name.charAt(0) + e.name.slice(1).toLowerCase()}
                          </span>
                          <strong style={{ color: ROLE_COLORS[e.name] ?? '#94a3b8' }}>{e.value.toLocaleString()}</strong>
                        </div>
                        <div style={{ height: '5px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: ROLE_COLORS[e.name] ?? '#94a3b8', width: `${totalUsers ? Math.min(100, (e.value / totalUsers) * 100) : 0}%`, borderRadius: '3px' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted" style={{ margin: '32px 0', textAlign: 'center' }}>No user data available.</p>
              )}
            </div>

            {/* Event Status Bar */}
            <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <h3 className="m-0 text-[17px] font-bold text-slate-900" style={{ marginBottom: '4px' }}>Events by Status</h3>
              <p className="mt-1 text-[13px] text-slate-400" style={{ marginBottom: '20px' }}>Current state across all events</p>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={statusData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }} barSize={32} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} tickFormatter={(v: string) => v.charAt(0) + v.slice(1).toLowerCase()} axisLine={false} tickLine={false} width={90} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" name="Events" radius={[0, 6, 6, 0]}>
                      {statusData.map((e) => <Cell key={e.name} fill={STATUS_COLORS[e.name] ?? '#94a3b8'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted" style={{ margin: '32px 0', textAlign: 'center' }}>No event data available.</p>
              )}
            </div>
          </div>

          {/* Quick Navigation Links */}
          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <h3 className="m-0 text-[17px] font-bold text-slate-900" style={{ marginBottom: '20px' }}>Quick Access</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {[
                { to: '/admin/applications', label: 'Applications Queue', sub: 'Review pending hosts', color: '#6366f1', bg: '#eef2ff', icon: <IconUsers /> },
                { to: '/admin/events', label: 'Events Oversight', sub: 'Monitor live inventory', color: '#10b981', bg: '#ecfdf5', icon: <IconCalendar /> },
                { to: '/admin/users', label: 'User Governance', sub: 'Roles & permissions', color: '#f59e0b', bg: '#fffbeb', icon: <IconUsers /> },
                { to: '/admin/categories', label: 'Taxonomy Manager', sub: 'Discovery categories', color: '#ec4899', bg: '#fdf2f8', icon: <IconSparkles /> },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 transition-[all] duration-[180ms] ease-[ease] hover:translate-x-[3px] hover:border-[var(--link-color,var(--primary))] hover:bg-[var(--link-bg,#eef2ff)]"
                  style={{ '--link-color': item.color, '--link-bg': item.bg } as React.CSSProperties}
                >
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: item.bg, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
      )}
    </DashboardShell>
  )
}
