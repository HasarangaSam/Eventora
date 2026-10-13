import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { DashboardShell } from '../analytics/dashboard-shell'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'

type EventRow = {
  id: string; title: string; status: string; startAt: string; city: string; capacity: number | null; ticketsSold: number
  registrations: { confirmed: number; pending: number; expired: number }
  tickets: { issued: number; checkedIn: number; voided: number }; attendanceRate: number
  grossSales: { currency: string; amount: string; payments: number }[]
}

const panel = 'rounded-xl border border-slate-200 bg-white shadow-sm'
const dateText = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const amountText = (amount: string, currency: string) => `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function State({ value }: { value: string }) {
  const style = value === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700' : value === 'DRAFT' ? 'bg-slate-100 text-slate-600' : value === 'CANCELLED' ? 'bg-rose-50 text-rose-700' : 'bg-indigo-50 text-indigo-700'
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{value[0] + value.slice(1).toLowerCase()}</span>
}

export function OrganizerOverviewPage() {
  const request = useAuthenticatedApi()
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    request<{ events: EventRow[] }>({ method: 'GET', url: '/organizer/analytics/events' })
      .then(({ data }) => { if (active) setEvents(data.events) })
      .catch(() => { if (active) setFailed(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [request])

  const currencyTotals = useMemo(() => {
    const totals = new Map<string, number>()
    for (const event of events) for (const revenue of event.grossSales) totals.set(revenue.currency, (totals.get(revenue.currency) ?? 0) + Number(revenue.amount))
    return [...totals.entries()]
  }, [events])
  const confirmed = events.reduce((total, event) => total + event.registrations.confirmed, 0)
  const tickets = events.reduce((total, event) => total + event.tickets.issued, 0)
  const upcoming = events.filter((event) => event.status === 'PUBLISHED' && new Date(event.startAt).getTime() >= Date.now()).sort((a, b) => a.startAt.localeCompare(b.startAt)).slice(0, 5)
  const needsAttention = events.filter((event) => event.status === 'DRAFT' || event.registrations.pending > 0 || (event.status === 'PUBLISHED' && event.capacity !== null && event.ticketsSold >= event.capacity)).slice(0, 4)

  return <DashboardShell role="ORGANIZER" pageTitle="Organizer overview">
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-1 text-sm font-semibold text-indigo-700">YOUR ORGANIZER SPACE</p><h1 className="m-0 text-2xl font-bold tracking-tight text-slate-900">Good to see you</h1><p className="mb-0 mt-2 text-sm text-slate-600">Check upcoming events, registrations, and sales from one place.</p></div><Link to="/organizer/events" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Create or manage events</Link></div>

      {failed && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">We couldn’t load your organizer overview. Refresh the page to try again.</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`${panel} p-4`}><p className="m-0 text-sm text-slate-500">Events</p><strong className="mt-2 block text-2xl text-slate-900">{loading ? '—' : events.length}</strong><span className="text-xs text-slate-500">Across all event stages</span></div>
        <div className={`${panel} p-4`}><p className="m-0 text-sm text-slate-500">Confirmed registrations</p><strong className="mt-2 block text-2xl text-slate-900">{loading ? '—' : confirmed.toLocaleString()}</strong><span className="text-xs text-slate-500">People registered for your events</span></div>
        <div className={`${panel} p-4`}><p className="m-0 text-sm text-slate-500">Tickets issued</p><strong className="mt-2 block text-2xl text-slate-900">{loading ? '—' : tickets.toLocaleString()}</strong><span className="text-xs text-slate-500">Valid tickets across your events</span></div>
        <div className={`${panel} p-4`}><p className="m-0 text-sm text-slate-500">Verified sales</p>{loading ? <strong className="mt-2 block text-2xl">—</strong> : currencyTotals.length ? <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{currencyTotals.map(([currency, value]) => <strong key={currency} className="text-lg text-slate-900">{amountText(String(value), currency)}</strong>)}</div> : <strong className="mt-2 block text-2xl text-slate-900">—</strong>}<span className="text-xs text-slate-500">Confirmed by the payment provider</span></div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className={`${panel} overflow-hidden`}><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="m-0 text-base font-bold text-slate-900">Coming up</h2><p className="mb-0 mt-1 text-sm text-slate-500">Your next published events</p></div><Link to="/organizer/events" className="text-sm font-semibold text-indigo-700 hover:underline">All events</Link></div>
          {loading ? <p className="p-5 text-sm text-slate-500">Loading events…</p> : upcoming.length ? <div className="divide-y divide-slate-100">{upcoming.map((event) => <Link key={event.id} to="/organizer/sales" className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50"><div><strong className="block text-sm text-slate-900">{event.title}</strong><span className="text-xs text-slate-500">{dateText(event.startAt)} · {event.city}</span></div><div className="flex items-center gap-4 text-right"><span className="text-sm font-semibold text-slate-700">{event.tickets.issued}{event.capacity ? ` / ${event.capacity}` : ''} tickets</span><State value={event.status} /></div></Link>)}</div> : <div className="p-6"><p className="m-0 font-semibold text-slate-800">No upcoming events</p><p className="mt-1 text-sm text-slate-500">Create an event or publish one from your events page.</p></div>}
        </div>
        <div className={`${panel} overflow-hidden`}><div className="border-b border-slate-200 px-5 py-4"><h2 className="m-0 text-base font-bold text-slate-900">Needs your attention</h2><p className="mb-0 mt-1 text-sm text-slate-500">A few items to review</p></div>
          {loading ? <p className="p-5 text-sm text-slate-500">Loading…</p> : needsAttention.length ? <div className="divide-y divide-slate-100">{needsAttention.map((event) => <Link key={event.id} to="/organizer/events" className="block px-5 py-4 hover:bg-slate-50"><div className="flex items-center justify-between gap-3"><strong className="text-sm text-slate-900">{event.title}</strong><State value={event.status} /></div><span className="mt-1 block text-xs text-slate-500">{event.status === 'DRAFT' ? 'Finish setup and publish your event' : event.registrations.pending ? `${event.registrations.pending} pending registration${event.registrations.pending === 1 ? '' : 's'}` : 'Ticket capacity reached'}</span></Link>)}</div> : <p className="p-5 text-sm text-slate-600">You’re all caught up.</p>}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3"><Link to="/organizer/events" className={`${panel} p-4 transition hover:border-indigo-300`}><span className="text-xs font-semibold uppercase tracking-wide text-indigo-700">EVENT SETUP</span><strong className="mt-2 block text-sm text-slate-900">Create and manage events</strong><span className="mt-1 block text-sm text-slate-500">Edit details, tickets, schedule, and event status.</span></Link><Link to="/organizer/sales" className={`${panel} p-4 transition hover:border-indigo-300`}><span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">SALES & PEOPLE</span><strong className="mt-2 block text-sm text-slate-900">Review sales and participants</strong><span className="mt-1 block text-sm text-slate-500">Find registrations, ticket references, and payment details.</span></Link><Link to="/organizer/checkin" className={`${panel} p-4 transition hover:border-indigo-300`}><span className="text-xs font-semibold uppercase tracking-wide text-amber-700">EVENT ENTRY</span><strong className="mt-2 block text-sm text-slate-900">Open check-in</strong><span className="mt-1 block text-sm text-slate-500">Scan ticket QR codes or enter a ticket reference.</span></Link></section>
    </div>
  </DashboardShell>
}
