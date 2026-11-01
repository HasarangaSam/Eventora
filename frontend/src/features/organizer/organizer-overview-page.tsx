import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { DashboardShell } from '../analytics/dashboard-shell'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'

type EventRow = {
  id: string; title: string; status: string; startAt: string; endAt: string; city: string; capacity: number | null; ticketsSold: number
  registrations: { confirmed: number; pending: number; expired: number }
  tickets: { issued: number; checkedIn: number; voided: number }; attendanceRate: number
  grossSales: { currency: string; amount: string; payments: number }[]
}

const panel = 'rounded-xl border border-slate-200 bg-white shadow-sm'
const dateText = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const amountText = (amount: string, currency: string) => `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function State({ value }: { value: string }) {
  const style =
    value === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700' :
    value === 'DRAFT' ? 'bg-slate-100 text-slate-600' :
    value === 'CANCELLED' ? 'bg-rose-50 text-rose-700' :
    value === 'COMPLETED' ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-700'
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{value === 'COMPLETED' ? 'Past' : value[0] + value.slice(1).toLowerCase()}</span>
}

function MetricSkeleton() {
  return <div className="mt-2 h-8 w-20 animate-pulse rounded-md bg-slate-100" />
}

export function OrganizerOverviewPage() {
  const request = useAuthenticatedApi()
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [clock, setClock] = useState(() => Date.now())

  useEffect(() => {
    let active = true
    request<{ events: EventRow[] }>({ method: 'GET', url: '/organizer/analytics/events' })
      .then(({ data }) => { if (active) setEvents(data.events) })
      .catch(() => { if (active) setFailed(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [request])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const currencyTotals = useMemo(() => {
    const totals = new Map<string, number>()
    for (const event of events)
      for (const revenue of event.grossSales)
        totals.set(revenue.currency, (totals.get(revenue.currency) ?? 0) + Number(revenue.amount))
    return [...totals.entries()]
  }, [events])

  const confirmed = events.reduce((total, event) => total + event.registrations.confirmed, 0)
  const tickets = events.reduce((total, event) => total + event.tickets.issued, 0)
  const now = clock

  const inProgress = events
    .filter((event) => event.status === 'PUBLISHED' && new Date(event.startAt).getTime() <= now && new Date(event.endAt).getTime() > now)
    .sort((a, b) => a.endAt.localeCompare(b.endAt))
    .slice(0, 4)

  const upcoming = events
    .filter((event) => event.status === 'PUBLISHED' && new Date(event.startAt).getTime() > now && new Date(event.endAt).getTime() > now)
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 5)

  const recentlyCompleted = events
    .filter((event) => event.status === 'COMPLETED' || (event.status === 'PUBLISHED' && new Date(event.endAt).getTime() <= now))
    .sort((a, b) => b.endAt.localeCompare(a.endAt))
    .slice(0, 5)

  // Bug fix: was filtering to slice(0, 4) but keeping — attention items link to specific edit pages now
  const needsAttention = events
    .filter((event) =>
      event.status === 'DRAFT' ||
      event.registrations.pending > 0 ||
      (event.status === 'PUBLISHED' && event.capacity !== null && event.ticketsSold >= event.capacity)
    )
    .slice(0, 4)

  return (
    <DashboardShell role="ORGANIZER" pageTitle="Organizer overview">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-sm font-semibold text-indigo-700">YOUR ORGANIZER SPACE</p>
            <h1 className="m-0 text-2xl font-bold tracking-tight text-slate-900">{greeting()} 👋</h1>
            <p className="mb-0 mt-2 text-sm text-slate-600">Check upcoming events, registrations, and sales from one place.</p>
          </div>
          <Link
            to="/organizer/events/new"
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            + Create event
          </Link>
        </div>

        {failed && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            We couldn't load your organizer overview. Refresh the page to try again.
          </div>
        )}

        {/* KPI Cards */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`${panel} p-4`}>
            <p className="m-0 text-sm text-slate-500">Events</p>
            {loading ? <MetricSkeleton /> : <strong className="mt-2 block text-2xl text-slate-900">{events.length}</strong>}
            <span className="mt-1 block text-xs text-slate-500">Across all event stages</span>
          </div>
          <div className={`${panel} p-4`}>
            <p className="m-0 text-sm text-slate-500">Confirmed registrations</p>
            {loading ? <MetricSkeleton /> : <strong className="mt-2 block text-2xl text-slate-900">{confirmed.toLocaleString()}</strong>}
            <span className="mt-1 block text-xs text-slate-500">People registered for your events</span>
          </div>
          <div className={`${panel} p-4`}>
            <p className="m-0 text-sm text-slate-500">Tickets issued</p>
            {loading ? <MetricSkeleton /> : <strong className="mt-2 block text-2xl text-slate-900">{tickets.toLocaleString()}</strong>}
            <span className="mt-1 block text-xs text-slate-500">Valid tickets across your events</span>
          </div>
          <div className={`${panel} p-4`}>
            <p className="m-0 text-sm text-slate-500">Verified sales</p>
            {loading
              ? <MetricSkeleton />
              : currencyTotals.length
                ? <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {currencyTotals.map(([currency, value]) => (
                      <strong key={currency} className="text-lg text-slate-900">{amountText(String(value), currency)}</strong>
                    ))}
                  </div>
                : <strong className="mt-2 block text-2xl text-slate-900">—</strong>
            }
            <span className="mt-1 block text-xs text-slate-500">Confirmed by the payment provider</span>
          </div>
        </section>

        {inProgress.length > 0 && <section className={`${panel} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><div><h2 className="m-0 text-base font-bold text-slate-900">Happening now</h2><p className="mb-0 mt-1 text-sm text-slate-500">Events currently inside their scheduled time window.</p></div><Link to="/organizer/checkin" className="text-sm font-semibold text-indigo-700 hover:underline">Open check-in →</Link></div>
          <div className="divide-y divide-slate-100">{inProgress.map((event) => <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><strong className="block text-sm text-slate-900">{event.title}</strong><span className="text-xs text-slate-500">Ends {dateText(event.endAt)} · {event.city}</span></div><div className="flex items-center gap-3"><span className="text-sm font-semibold text-slate-700">{event.tickets.checkedIn} / {event.tickets.issued} checked in</span><Link to={`/organizer/events/${event.id}/check-in`} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700">Open console</Link></div></div>)}</div>
        </section>}

        {/* Coming up + Needs attention */}
        <section className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          {/* Coming up */}
          <div className={`${panel} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="m-0 text-base font-bold text-slate-900">Coming up</h2>
                <p className="mb-0 mt-1 text-sm text-slate-500">Your next published events</p>
              </div>
              <Link to="/organizer/events" className="text-sm font-semibold text-indigo-700 hover:underline">All events</Link>
            </div>
            {loading
              ? <p className="p-5 text-sm text-slate-500">Loading events…</p>
              : upcoming.length
                ? <div className="divide-y divide-slate-100">
                    {upcoming.map((event) => (
                      // Bug fix: links now go to the per-event sales report, not the generic /organizer/sales page
                      <Link
                        key={event.id}
                        to={`/organizer/sales/${event.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50"
                      >
                        <div>
                          <strong className="block text-sm text-slate-900">{event.title}</strong>
                          <span className="text-xs text-slate-500">{dateText(event.startAt)} · {event.city}</span>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <span className="text-sm font-semibold text-slate-700">
                            {event.tickets.issued}{event.capacity ? ` / ${event.capacity}` : ''} tickets
                          </span>
                          <State value={event.status} />
                        </div>
                      </Link>
                    ))}
                  </div>
                : <div className="p-6">
                    <p className="m-0 font-semibold text-slate-800">No upcoming events</p>
                    <p className="mt-1 text-sm text-slate-500">Create an event or publish one from your events page.</p>
                    <Link to="/organizer/events/new" className="mt-3 inline-block text-sm font-semibold text-indigo-700 hover:underline">
                      Create an event →
                    </Link>
                  </div>
            }
          </div>

          {/* Needs attention */}
          <div className={`${panel} overflow-hidden`}>
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="m-0 text-base font-bold text-slate-900">Needs your attention</h2>
              <p className="mb-0 mt-1 text-sm text-slate-500">A few items to review</p>
            </div>
            {loading
              ? <p className="p-5 text-sm text-slate-500">Loading…</p>
              : needsAttention.length
                ? <div className="divide-y divide-slate-100">
                    {needsAttention.map((event) => (
                      // Bug fix: links now go directly to the event's edit page, not the generic events list
                      <Link
                        key={event.id}
                        to={`/organizer/events/${event.id}/edit`}
                        className="block px-5 py-4 hover:bg-slate-50"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <strong className="text-sm text-slate-900">{event.title}</strong>
                          <State value={event.status} />
                        </div>
                        <span className="mt-1 block text-xs text-slate-500">
                          {event.status === 'DRAFT'
                            ? 'Finish setup and publish your event'
                            : event.registrations.pending
                              ? `${event.registrations.pending} pending registration${event.registrations.pending === 1 ? '' : 's'}`
                              : 'Ticket capacity reached — consider expanding'}
                        </span>
                      </Link>
                    ))}
                  </div>
                : <p className="p-5 text-sm text-slate-600">You're all caught up 🎉</p>
            }
          </div>
        </section>

        <section className={`${panel} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="m-0 text-base font-bold text-slate-900">Recently completed</h2><p className="mb-0 mt-1 text-sm text-slate-500">Review sales, attendees, and check-in results from past events.</p></div><Link to="/organizer/events?status=COMPLETED" className="text-sm font-semibold text-indigo-700 hover:underline">All past events</Link></div>
          {loading ? <p className="p-5 text-sm text-slate-500">Loading past events…</p> : recentlyCompleted.length ? <div className="divide-y divide-slate-100">{recentlyCompleted.map((event) => <Link key={event.id} to={`/organizer/sales/${event.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50"><div><strong className="block text-sm text-slate-900">{event.title}</strong><span className="text-xs text-slate-500">Ended {dateText(event.endAt)} · {event.city}</span></div><div className="flex items-center gap-4"><span className="text-sm font-semibold text-slate-700">{event.tickets.issued} tickets · {event.tickets.checkedIn} checked in</span><span className="text-sm font-semibold text-indigo-700">Open report →</span></div></Link>)}</div> : <p className="p-5 text-sm text-slate-500">Completed events will appear here after their scheduled end time.</p>}
        </section>

        {/* Quick shortcuts */}
        <section className="grid gap-3 sm:grid-cols-3">
          <Link to="/organizer/events" className={`${panel} group p-4 transition hover:border-indigo-300 hover:shadow-md`}>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-100">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700">EVENT SETUP</span>
            <strong className="mt-1 block text-sm text-slate-900">Create and manage events</strong>
            <span className="mt-1 block text-sm text-slate-500">Edit details, tickets, schedule, and event status.</span>
          </Link>

          <Link to="/organizer/sales" className={`${panel} group p-4 transition hover:border-emerald-300 hover:shadow-md`}>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition group-hover:bg-emerald-100">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">SALES & PEOPLE</span>
            <strong className="mt-1 block text-sm text-slate-900">Review sales and participants</strong>
            <span className="mt-1 block text-sm text-slate-500">Find registrations, ticket references, and payment details.</span>
          </Link>

          <Link to="/organizer/checkin" className={`${panel} group p-4 transition hover:border-amber-300 hover:shadow-md`}>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 transition group-hover:bg-amber-100">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">EVENT ENTRY</span>
            <strong className="mt-1 block text-sm text-slate-900">Open check-in console</strong>
            <span className="mt-1 block text-sm text-slate-500">Scan ticket QR codes or enter a ticket reference at the door.</span>
          </Link>
        </section>
      </div>
    </DashboardShell>
  )
}
