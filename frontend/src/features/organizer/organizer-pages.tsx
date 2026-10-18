import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { DashboardShell } from '../analytics/dashboard-shell'

type EventOption = { id: string; title: string; status: string; startAt: string; city: string; venue?: string }
type EventSales = EventOption & {
  capacity: number | null; ticketsSold: number
  registrations: { confirmed: number; pending: number; expired: number }
  tickets: { issued: number; checkedIn: number; voided: number }; attendanceRate: number
  grossSales: { currency: string; amount: string; payments: number }[]
}
type TicketType = { id: string; name: string; price: string; currency: string; quantity: number; quantitySold: number; quantityReserved: number; quantityAvailable: number; isActive: boolean }
type Report = {
  event: EventOption & { endAt: string; timezone: string; capacity: number | null; ticketsSold: number; ticketsReserved: number; ticketTypes: TicketType[] }
  confirmedRegistrations: number; pendingRegistrations: number
  grossSales: { currency: string; amount: string; payments: number }[]
  attendance: { issued: number; checkedIn: number; rate: number }
  salesTrend: { months: { month: string; grossSales: { currency: string; amount: string; payments: number }[] }[] }
  registrationTrend: { months: { month: string; created: number; confirmed: number }[] }
}
type Participant = {
  id: string; quantity: number; totalAmount: string; currency: string; status: string; createdAt: string
  attendee: { name: string; email: string }; ticketType: { name: string }
  payment: { status: string } | null
  tickets: { id: string; reference: string; status: string; checkedInAt: string | null }[]
}
type Roster = { page: number; pageSize: number; total: number; totalPages: number; participants: Participant[] }

const panel = 'rounded-xl border border-slate-200 bg-white shadow-sm'
const input = 'h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
const money = (amount: string, currency: string) => `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dateLabel = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

function StatusPill({ value }: { value: string }) {
  const tones: Record<string, string> = {
    PUBLISHED: 'bg-emerald-50 text-emerald-700', CONFIRMED: 'bg-emerald-50 text-emerald-700', SUCCEEDED: 'bg-emerald-50 text-emerald-700', CHECKED_IN: 'bg-indigo-50 text-indigo-700',
    DRAFT: 'bg-slate-100 text-slate-600', PENDING: 'bg-amber-50 text-amber-700', UNPAID: 'bg-amber-50 text-amber-700',
    CANCELLED: 'bg-rose-50 text-rose-700', EXPIRED: 'bg-slate-100 text-slate-600', FAILED: 'bg-rose-50 text-rose-700',
  }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[value] ?? 'bg-slate-100 text-slate-600'}`}>{value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())}</span>
}

export { OrganizerEventsPage } from './organizer-events-page'
export { OrganizerCreateEventPage } from './organizer-create-event-page'
export { OrganizerEditEventPage } from './organizer-edit-event-page'

export function OrganizerSalesPage() {
  return <OrganizerSalesIndex />
}

function OrganizerSalesIndex() {
  const request = useAuthenticatedApi()
  const [events, setEvents] = useState<EventSales[]>([])
  const [eventId, setEventId] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    request<{ events: EventSales[] }>({ method: 'GET', url: '/organizer/analytics/events' })
      .then(({ data }) => { if (active) setEvents(data.events) })
      .catch(() => { if (active) setError('We couldn’t load event sales. Please try again.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [request])

  const visible = useMemo(() => events.filter((event) => (!eventId || event.id === eventId)
    && (!status || event.status === status)
    && (!search || `${event.title} ${event.city} ${event.venue}`.toLowerCase().includes(search.toLowerCase()))), [eventId, events, search, status])

  return <DashboardShell role="ORGANIZER" pageTitle="Sales">
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-1 text-sm font-semibold text-indigo-700">SALES REPORTS</p><h1 className="m-0 text-2xl font-bold tracking-tight text-slate-900">Choose an event</h1><p className="mb-0 mt-2 text-sm text-slate-600">Filter your events, then open one to see its full report.</p></div><Link to="/organizer/events" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Manage events</Link></div>

      <section className={`${panel} p-4`}><div className="grid gap-3 md:grid-cols-[1fr_1fr_1.4fr]"><label className="grid gap-1.5 text-xs font-semibold text-slate-600">Filter by event<select className={input} value={eventId} onChange={(event) => setEventId(event.target.value)}><option value="">All events</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label><label className="grid gap-1.5 text-xs font-semibold text-slate-600">Event status<select className={input} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="PUBLISHED">Published</option><option value="DRAFT">Draft</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></select></label><label className="grid gap-1.5 text-xs font-semibold text-slate-600">Search by name or place<input className={input} placeholder="For example, Summer concert" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div></section>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
      {loading ? <div className={`${panel} p-8 text-center text-sm text-slate-500`}>Loading your events…</div> : visible.length === 0 ? <div className={`${panel} p-8 text-center`}><h2 className="m-0 text-lg font-bold text-slate-900">{events.length ? 'No events match those filters' : 'No events yet'}</h2><p className="mt-2 text-sm text-slate-500">{events.length ? 'Clear a filter or try another search.' : 'Create an event to start tracking sales.'}</p>{!events.length && <Link to="/organizer/events" className="mt-3 inline-flex rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">Create an event</Link>}</div> : <section className="grid gap-3 lg:grid-cols-2">{visible.map((event) => <Link key={event.id} to={`/organizer/sales/${event.id}`} className={`${panel} group block p-5 transition hover:border-indigo-300 hover:shadow-md`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="m-0 text-base font-bold text-slate-900 group-hover:text-indigo-700">{event.title}</h2><p className="mb-0 mt-1 text-sm text-slate-500">{dateLabel(event.startAt)} · {event.city}</p></div><StatusPill value={event.status} /></div><div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4"><div><span className="block text-xs text-slate-500">Tickets sold</span><strong className="mt-1 block text-sm text-slate-900">{event.tickets.issued}{event.capacity ? <span className="font-normal text-slate-500"> / {event.capacity}</span> : ''}</strong></div><div><span className="block text-xs text-slate-500">Registered</span><strong className="mt-1 block text-sm text-slate-900">{event.registrations.confirmed}</strong></div><div><span className="block text-xs text-slate-500">Verified sales</span>{event.grossSales.length ? event.grossSales.map((row) => <strong key={row.currency} className="mt-1 block text-sm text-slate-900">{money(row.amount, row.currency)}</strong>) : <strong className="mt-1 block text-sm text-slate-400">No sales yet</strong>}</div></div><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm"><span className="text-slate-500">{event.tickets.checkedIn} checked in · {Math.round(event.attendanceRate * 100)}%</span><span className="font-semibold text-indigo-700">Open report →</span></div></Link>)}</section>}
    </div>
  </DashboardShell>
}

export function OrganizerSalesReportPage() {
  const { eventId = '' } = useParams()
  const request = useAuthenticatedApi()
  const [report, setReport] = useState<Report | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    Promise.all([
      request<Report>({ method: 'GET', url: `/organizer/events/${eventId}/analytics` }),
      request<Roster>({ method: 'GET', url: `/organizer/events/${eventId}/participants`, params: { page: 1, pageSize: 6 } }),
    ]).then(([reportResponse, participantResponse]) => {
      if (active) { setReport(reportResponse.data); setParticipants(participantResponse.data.participants) }
    }).catch(() => { if (active) setError('We couldn’t load this event report. Check the event link and try again.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [eventId, request])

  const salesCurrency = report?.grossSales ?? []
  const salesMonths = report?.salesTrend.months ?? []
  const registrationTrend = report?.registrationTrend.months ?? []
  const maxRegistrations = Math.max(1, ...registrationTrend.map((month) => month.created))
  const trendCurrencies = [...new Set(salesMonths.flatMap((month) => month.grossSales.map((sale) => sale.currency)))]
  const maxSalesByCurrency = new Map(trendCurrencies.map((currency) => [currency, Math.max(0, ...salesMonths.map((month) => Number(month.grossSales.find((sale) => sale.currency === currency)?.amount ?? 0)))]))

  return <DashboardShell role="ORGANIZER" pageTitle="Event sales report">
    <div className="space-y-5">
      <Link to="/organizer/sales" className="inline-flex text-sm font-semibold text-indigo-700 hover:underline">← All event reports</Link>
      {loading ? <div className={`${panel} p-10 text-center text-sm text-slate-500`}>Loading event report…</div> : error || !report ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error || 'This event report is unavailable.'}</div> : <>
        <section className={`${panel} p-5`}><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2"><StatusPill value={report.event.status} /></div><h1 className="m-0 text-2xl font-bold tracking-tight text-slate-900">{report.event.title}</h1><p className="mb-0 mt-2 text-sm text-slate-600">{dateLabel(report.event.startAt)} · {report.event.venue}, {report.event.city}</p></div><div className="flex flex-wrap gap-2"><Link to={`/organizer/participants?event=${encodeURIComponent(eventId)}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Participants</Link><Link to={`/organizer/events/${eventId}/check-in`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Open check-in</Link><Link to={`/organizer/events/${eventId}/edit`} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Edit event</Link></div></div></section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`${panel} p-4`}><span className="text-sm text-slate-500">Verified sales</span>{salesCurrency.length ? salesCurrency.map((row) => <strong key={row.currency} className="mt-2 block text-xl text-slate-900">{money(row.amount, row.currency)}</strong>) : <strong className="mt-2 block text-xl text-slate-900">—</strong>}<span className="mt-1 block text-xs text-slate-500">Payments confirmed by provider</span></div>
          <div className={`${panel} p-4`}><span className="text-sm text-slate-500">Registrations</span><strong className="mt-2 block text-2xl text-slate-900">{report.confirmedRegistrations.toLocaleString()}</strong><span className="mt-1 block text-xs text-slate-500">{report.pendingRegistrations} still pending</span></div>
          <div className={`${panel} p-4`}><span className="text-sm text-slate-500">Tickets issued</span><strong className="mt-2 block text-2xl text-slate-900">{report.attendance.issued.toLocaleString()}{report.event.capacity ? <span className="text-base font-normal text-slate-500"> / {report.event.capacity}</span> : ''}</strong><span className="mt-1 block text-xs text-slate-500">{report.event.ticketsReserved} currently held</span></div>
          <div className={`${panel} p-4`}><span className="text-sm text-slate-500">Attendance</span><strong className="mt-2 block text-2xl text-slate-900">{Math.round(report.attendance.rate * 100)}%</strong><span className="mt-1 block text-xs text-slate-500">{report.attendance.checkedIn} of {report.attendance.issued} tickets checked in</span></div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <div className={`${panel} overflow-hidden`}><div className="border-b border-slate-200 px-5 py-4"><h2 className="m-0 text-base font-bold text-slate-900">Ticket sales</h2><p className="mb-0 mt-1 text-sm text-slate-500">Sold and available tickets by type.</p></div>{report.event.ticketTypes.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Ticket type', 'Price', 'Sold', 'On hold', 'Available'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{report.event.ticketTypes.map((ticket) => <tr key={ticket.id}><td className="px-4 py-3 font-semibold text-slate-800">{ticket.name}{!ticket.isActive && <span className="ml-2 text-xs font-normal text-slate-500">Not on sale</span>}</td><td className="px-4 py-3 text-slate-700">{money(ticket.price, ticket.currency)}</td><td className="px-4 py-3 tabular-nums text-slate-700">{ticket.quantitySold}</td><td className="px-4 py-3 tabular-nums text-slate-700">{ticket.quantityReserved}</td><td className="px-4 py-3 tabular-nums text-slate-700">{ticket.quantityAvailable}</td></tr>)}</tbody></table></div> : <p className="p-5 text-sm text-slate-500">No ticket types have been added.</p>}</div>
          <div className={`${panel} overflow-hidden`}><div className="border-b border-slate-200 px-5 py-4"><h2 className="m-0 text-base font-bold text-slate-900">Registrations over time</h2><p className="mb-0 mt-1 text-sm text-slate-500">New and confirmed registrations, by month.</p></div><div className="space-y-4 p-5">{registrationTrend.map((month) => <div key={month.month} className="grid grid-cols-[72px_1fr_90px] items-center gap-3"><span className="text-xs font-medium text-slate-600">{new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${month.month}-01T00:00:00Z`))}</span><div className="space-y-1"><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(month.created ? 3 : 0, month.created / maxRegistrations * 100)}%` }} /></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(month.confirmed ? 3 : 0, month.confirmed / maxRegistrations * 100)}%` }} /></div></div><span className="text-right text-xs text-slate-500">{month.created} new · {month.confirmed} confirmed</span></div>)}<div className="flex gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-indigo-500" />New</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />Confirmed</span></div></div></div>
        </section>

        <section className={`${panel} overflow-hidden`}><div className="border-b border-slate-200 px-5 py-4"><h2 className="m-0 text-base font-bold text-slate-900">Monthly sales</h2><p className="mb-0 mt-1 text-sm text-slate-500">Payments confirmed by the provider, grouped by currency.</p></div>{trendCurrencies.length ? <div className="grid gap-6 p-5 md:grid-cols-2">{trendCurrencies.map((currency) => <div key={currency}><h3 className="mb-3 mt-0 text-sm font-semibold text-slate-800">{currency}</h3><div className="space-y-3">{salesMonths.map((month) => { const amount = Number(month.grossSales.find((sale) => sale.currency === currency)?.amount ?? 0); const maxAmount = maxSalesByCurrency.get(currency) ?? 0; return <div key={month.month} className="grid grid-cols-[70px_1fr_auto] items-center gap-3"><span className="text-xs text-slate-500">{new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${month.month}-01T00:00:00Z`))}</span><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${maxAmount ? Math.max(amount ? 3 : 0, amount / maxAmount * 100) : 0}%` }} /></div><span className="text-right text-xs font-medium tabular-nums text-slate-700">{money(String(amount), currency)}</span></div> })}</div></div>)}</div> : <p className="p-5 text-sm text-slate-500">No verified sales in the last six months.</p>}</section>

        <section className={`${panel} overflow-hidden`}><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><div><h2 className="m-0 text-base font-bold text-slate-900">Recent participants</h2><p className="mb-0 mt-1 text-sm text-slate-500">The latest registrations for this event.</p></div><Link to={`/organizer/participants?event=${encodeURIComponent(eventId)}`} className="text-sm font-semibold text-indigo-700 hover:underline">View all participants →</Link></div>{participants.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Name', 'Email', 'Ticket', 'Payment', 'Entry'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{participants.map((person) => <tr key={person.id}><td className="px-4 py-3 font-semibold text-slate-800">{person.attendee.name}</td><td className="px-4 py-3 text-slate-600">{person.attendee.email}</td><td className="px-4 py-3 text-slate-700">{person.ticketType.name} · {person.quantity}</td><td className="px-4 py-3"><StatusPill value={person.payment?.status ?? 'UNPAID'} /></td><td className="px-4 py-3 text-slate-600">{person.tickets.filter((ticket) => ticket.checkedInAt).length} / {person.tickets.length} checked in</td></tr>)}</tbody></table></div> : <p className="p-5 text-sm text-slate-500">No registrations for this event yet.</p>}</section>
      </>}
    </div>
  </DashboardShell>
}

export function OrganizerParticipantsPage() {
  const request = useAuthenticatedApi()
  const [searchParams, setSearchParams] = useSearchParams()
  const [events, setEvents] = useState<EventOption[]>([])
  const [eventId, setEventId] = useState(searchParams.get('event') ?? '')
  const [roster, setRoster] = useState<Roster | null>(null)
  const [search, setSearch] = useState('')
  const [registrationStatus, setRegistrationStatus] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [checkInStatus, setCheckInStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rosterLoading, setRosterLoading] = useState(false)

  useEffect(() => {
    let active = true
    request<{ events: EventSales[] }>({ method: 'GET', url: '/organizer/analytics/events' }).then(({ data }) => {
      if (!active) return
      setEvents(data.events)
      if (!data.events.some((event) => event.id === eventId)) {
        const next = data.events[0]?.id ?? ''
        setEventId(next)
        setSearchParams(next ? { event: next } : {})
      }
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [eventId, request, setSearchParams])

  const loadRoster = useCallback(async (targetPage: number) => {
    if (!eventId) { setRoster(null); return }
    setRosterLoading(true)
    try {
      const { data } = await request<Roster>({ method: 'GET', url: `/organizer/events/${eventId}/participants`, params: { page: targetPage, pageSize: 25, search: search || undefined, registrationStatus: registrationStatus || undefined, paymentStatus: paymentStatus || undefined, checkInStatus: checkInStatus || undefined } })
      setRoster(data)
    } finally { setRosterLoading(false) }
  }, [checkInStatus, eventId, paymentStatus, registrationStatus, request, search])

  useEffect(() => { setPage(1) }, [eventId, search, registrationStatus, paymentStatus, checkInStatus])
  useEffect(() => { void loadRoster(page).catch(() => setRoster(null)) }, [loadRoster, page])

  async function exportCsv() {
    if (!eventId || !roster?.total) return
    const all: Participant[] = []
    const pages = Math.ceil(roster.total / 100)
    for (let current = 1; current <= pages; current += 1) {
      const { data } = await request<Roster>({ method: 'GET', url: `/organizer/events/${eventId}/participants`, params: { page: current, pageSize: 100, search: search || undefined, registrationStatus: registrationStatus || undefined, paymentStatus: paymentStatus || undefined, checkInStatus: checkInStatus || undefined } })
      all.push(...data.participants)
    }
    const rows = [['Name', 'Email', 'Registration', 'Ticket type', 'Quantity', 'Amount', 'Payment', 'Ticket references', 'Check-in'], ...all.map((person) => [person.attendee.name, person.attendee.email, person.status, person.ticketType.name, String(person.quantity), money(person.totalAmount, person.currency), person.payment?.status ?? 'UNPAID', person.tickets.map((ticket) => ticket.reference).join(' '), person.tickets.some((ticket) => ticket.checkedInAt) ? 'Checked in' : 'Not checked in'])]
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${events.find((event) => event.id === eventId)?.title ?? 'event'}-participants.csv`; anchor.click(); URL.revokeObjectURL(url)
  }

  return <DashboardShell role="ORGANIZER" pageTitle="Participants">
    <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-1 text-sm font-semibold text-indigo-700">ATTENDEE RECORDS</p><h1 className="m-0 text-2xl font-bold text-slate-900">Participants</h1><p className="mb-0 mt-2 text-sm text-slate-600">Find registrations, review tickets and payments, or download a list.</p></div><Link to="/organizer/events" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Manage events</Link></div>
      {!loading && !events.length ? <section className={`${panel} p-8 text-center`}><h2 className="m-0 text-lg font-bold text-slate-900">Create an event to get started</h2><p className="mt-2 text-sm text-slate-600">Participant lists appear here after people register.</p><Link to="/organizer/events" className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">Create an event</Link></section> : <section className={`${panel} overflow-hidden`}>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 p-4"><label className="grid min-w-[260px] flex-1 gap-1.5 text-xs font-semibold text-slate-600">Event<select className={input} value={eventId} onChange={(event) => { setEventId(event.target.value); setSearchParams(event.target.value ? { event: event.target.value } : {}) }}>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label><button onClick={() => void exportCsv()} disabled={!roster?.total || rosterLoading} className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 disabled:opacity-50">Download CSV</button></div>
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4"><input aria-label="Search participants" className={`${input} min-w-[220px] flex-1`} placeholder="Search name, email, or ticket reference" value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Registration status" className={input} value={registrationStatus} onChange={(event) => setRegistrationStatus(event.target.value)}><option value="">All registrations</option><option value="CONFIRMED">Confirmed</option><option value="PENDING">Pending</option><option value="EXPIRED">Expired</option></select><select aria-label="Payment status" className={input} value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}><option value="">All payments</option><option value="SUCCEEDED">Paid</option><option value="PENDING">Pending</option><option value="FAILED">Failed</option><option value="UNPAID">No successful payment</option></select><select aria-label="Entry status" className={input} value={checkInStatus} onChange={(event) => setCheckInStatus(event.target.value)}><option value="">All entry statuses</option><option value="CHECKED_IN">Checked in</option><option value="NOT_CHECKED_IN">Has unchecked tickets</option></select></div>
        {loading || rosterLoading ? <p className="p-8 text-center text-sm text-slate-500">Loading participant details…</p> : !roster?.participants.length ? <p className="p-8 text-center text-sm text-slate-500">{roster?.total ? 'No participants match these filters.' : 'No registrations for this event yet.'}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1050px] border-collapse text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{['Participant', 'Ticket', 'Registered', 'Registration', 'Payment', 'Ticket references', 'Entry'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{roster.participants.map((person) => <tr key={person.id} className="hover:bg-slate-50"><td className="px-4 py-3"><strong className="block text-slate-900">{person.attendee.name}</strong><span className="text-xs text-slate-500">{person.attendee.email}</span></td><td className="px-4 py-3 text-slate-700">{person.ticketType.name}<span className="block text-xs text-slate-500">{person.quantity} {person.quantity === 1 ? 'ticket' : 'tickets'}</span></td><td className="px-4 py-3 text-slate-600">{dateLabel(person.createdAt)}</td><td className="px-4 py-3"><StatusPill value={person.status} /></td><td className="px-4 py-3"><StatusPill value={person.payment?.status ?? 'UNPAID'} /><span className="mt-1 block text-xs text-slate-500">{money(person.totalAmount, person.currency)}</span></td><td className="px-4 py-3"><div className="flex max-w-[240px] flex-wrap gap-1">{person.tickets.length ? person.tickets.map((ticket) => <span key={ticket.id} title={`${ticket.reference} · ${ticket.status}`} className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">{ticket.reference}</span>) : <span className="text-slate-400">Not issued</span>}</div></td><td className="px-4 py-3 text-slate-600">{person.tickets.filter((ticket) => ticket.checkedInAt).length} / {person.tickets.length} checked in</td></tr>)}</tbody></table></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-500"><span>{roster ? `${roster.total.toLocaleString()} registrations` : ''}</span><div className="flex items-center gap-2"><button disabled={!roster || page <= 1 || rosterLoading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md border border-slate-300 px-3 py-1.5 font-medium disabled:opacity-40">Previous</button><span>Page {roster?.page ?? page} of {roster?.totalPages ?? 1}</span><button disabled={!roster || page >= roster.totalPages || rosterLoading} onClick={() => setPage((value) => value + 1)} className="rounded-md border border-slate-300 px-3 py-1.5 font-medium disabled:opacity-40">Next</button></div></div>
        <p className="m-0 border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500">Names and email addresses are from the account used to register. Separate ticket holder names are not collected.</p>
      </section>}</div>
  </DashboardShell>
}
