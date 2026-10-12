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
  const [state, setState] = useState<{ loading: boolean; error: string | null; data: Payload | null }>({ loading: true, error: null, data: null })
  useEffect(() => {
    let active = true
    const path = role === 'ADMIN' ? '/admin/dashboard' : role === 'ORGANIZER' ? '/organizer/dashboard' : '/attendee/dashboard'
    void request<Payload>({ method: 'GET', url: path }).then(({ data }) => {
      if (active) setState({ loading: false, error: null, data })
    }).catch(() => { if (active) setState({ loading: false, error: 'Dashboard data could not be loaded.', data: null }) })
    if (role === 'ORGANIZER') void request<{ months: SalesMonth[] }>({ method: 'GET', url: '/organizer/analytics/sales' })
      .then(({ data }) => { if (active) setSalesTrend(data.months) }).catch(() => { if (active) setSalesTrend([]) })
    return () => { active = false }
  }, [attempt, request, role])

  if (state.loading) return <section className="analytics-panel" aria-live="polite"><p>Loading your dashboard…</p></section>
  if (state.error) return <section className="analytics-panel" role="alert"><p>{state.error}</p><button className="text-button" onClick={() => { setState({ loading: true, error: null, data: null }); setAttempt(value => value + 1) }}>Try again</button></section>
  if (!state.data) return null
  const data = state.data
  if (role === 'ATTENDEE') {
    const registrations = Array.isArray(data.registrations) ? data.registrations as Array<Record<string, unknown>> : []
    return <section className="analytics-panel"><div className="analytics-heading"><div><span className="eyebrow">Your events</span><h2>Attendee dashboard</h2></div><Link to="/tickets">Open my tickets ↗</Link></div>
      <div className="analytics-kpis"><Metric label="Active tickets" value={data.activeTickets} /><Metric label="Registrations" value={data.registrationCount} /></div>
      <h3>Upcoming events</h3><EventList items={data.upcomingEvents} empty="No upcoming event registrations." />
      <h3>Past events</h3><EventList items={data.pastEvents} empty="Past event registrations will appear here." />
      <h3>Recent registrations</h3>{registrations.length ? <div className="analytics-list">{registrations.map((registration) => {
        const event = registration.event as Record<string, unknown>
        const payment = Array.isArray(registration.payments) ? registration.payments[0] as Record<string, unknown> | undefined : undefined
        return <article className="analytics-row" key={String(registration.id)}><div><strong>{String(event?.title ?? 'Event')}</strong><span>{new Date(String(event?.startAt)).toLocaleDateString()} · {String(event?.city ?? '')}</span></div><span className="analytics-badge">{String(payment?.status ?? registration.status)}</span></article>
      })}</div> : <p className="analytics-empty">Your registrations will appear here when you book an event.</p>}</section>
  }
  const organizer = role === 'ORGANIZER'
  const statuses = (data.eventsByStatus ?? data.paymentsByStatus) as Record<string, number> | undefined
  const gross = Array.isArray(data.grossSales) ? data.grossSales as Array<{ currency: string; amount: string }> : []
  const users = data.usersByRole as Record<string, number> | undefined
  return <section className="analytics-panel"><div className="analytics-heading"><div><span className="eyebrow">{organizer ? 'Your organization' : 'Platform overview'}</span><h2>{organizer ? 'Organizer dashboard' : 'Administrator dashboard'}</h2></div>{organizer && <Link to="/account">Manage events ↗</Link>}</div>
    <div className="analytics-kpis">{organizer ? <><Metric label="Events" value={data.eventCount} /><Metric label="Confirmed registrations" value={data.confirmedRegistrations} /><Metric label="Tickets issued" value={data.ticketsSold} /></> : <><Metric label="Users" value={data.totalUsers} /><Metric label="Active users" value={data.activeUsers} /><Metric label="Pending applications" value={data.pendingApplications} /><Metric label="Registrations" value={data.registrationCount} /></>}</div>
    <div className="analytics-columns"><div><h3>{organizer ? 'Event status' : 'Users by role'}</h3><StatusList values={organizer ? statuses : users} /></div><div><h3>Gross sales</h3>{gross.length ? gross.map(item => <p className="analytics-money" key={item.currency}><strong>{item.currency} {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><span>Verified gross sales</span></p>) : <p className="analytics-empty">No verified sales yet.</p>}<p className="analytics-note">Gross sales are verified payment amounts; they are not profit or organizer payouts.</p></div></div>
    {organizer && <><h3>Sales trend · last six months</h3>{salesTrend.length ? <div className="analytics-list">{salesTrend.map(month => <article className="analytics-row" key={month.month}><strong>{new Date(`${month.month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</strong><div>{month.grossSales.length ? month.grossSales.map(item => <span className="analytics-month-sales" key={item.currency}>{item.currency} {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · {item.payments} payments</span>) : <span>No verified sales</span>}</div></article>)}</div> : <p className="analytics-empty">Sales trend is not available yet.</p>}</>}
    <h3>Attendance</h3><p className="analytics-attendance">{Number((data.attendance as Record<string, unknown> | undefined)?.checkedIn ?? 0)} checked in of {Number((data.attendance as Record<string, unknown> | undefined)?.issued ?? 0)} issued tickets</p>
    {organizer && <><h3>Your events</h3>{Array.isArray(data.events) && data.events.length ? <div className="analytics-list">{(data.events as Array<Record<string, unknown>>).map(event => <article key={String(event.id)} className="analytics-row"><div><strong>{String(event.title)}</strong><span>{new Date(String(event.startAt)).toLocaleDateString()} · {String(event.status)}</span></div><Link to={`/organizer/events/${String(event.id)}/check-in`}>Check in ↗</Link></article>)}</div> : <p className="analytics-empty">Create an event to start seeing its performance.</p>}</>}
  </section>
}

function Metric({ label, value }: { label: string; value: unknown }) { return <div className="analytics-metric"><span>{label}</span><strong>{Number(value ?? 0).toLocaleString()}</strong></div> }
function StatusList({ values }: { values?: Record<string, number> }) { return values && Object.keys(values).length ? <ul className="analytics-status-list">{Object.entries(values).map(([key, value]) => <li key={key}><span>{key.replaceAll('_', ' ').toLowerCase()}</span><strong>{value}</strong></li>)}</ul> : <p className="analytics-empty">No activity to report yet.</p> }
function EventList({ items, empty }: { items: unknown; empty: string }) {
  if (!Array.isArray(items) || items.length === 0) return <p className="analytics-empty">{empty}</p>
  return <div className="analytics-list">{(items as Array<Record<string, unknown>>).map(item => {
    const event = item.event as Record<string, unknown>
    return <article className="analytics-row" key={String(item.id)}><div><strong>{String(event.title)}</strong><span>{new Date(String(event.startAt)).toLocaleDateString()} · {String(event.city)}</span></div><span className="analytics-badge">{String(item.status)}</span></article>
  })}</div>
}
