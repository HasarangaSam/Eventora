import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { DashboardShell } from '../analytics/dashboard-shell'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { useToast } from '../../components/ui/toast'
import { IconCamera, IconCalendar } from '../../components/ui/icons'

interface OrganizerEvent {
  id: string
  title: string
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED'
  startAt: string
  endAt: string
  city: string
  venue: string
}

const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

export function OrganizerCheckinHubPage() {
  const request = useAuthenticatedApi()
  const toast = useToast()
  const [events, setEvents] = useState<OrganizerEvent[]>([])
  const [search, setSearch] = useState('')
  const [clock, setClock] = useState(() => Date.now())
  const [loading, setLoading] = useState(true)

  const loadEvents = useCallback(async () => {
    try {
      const { data } = await request<OrganizerEvent[]>({ method: 'GET', url: '/organizer/events' })
      // Only show events inside their check-in window, even if the completion worker has not run yet.
      setEvents(data.filter((e) => e.status === 'PUBLISHED' && new Date(e.endAt).getTime() > Date.now()).sort((a, b) => a.startAt.localeCompare(b.startAt)))
    } catch {
      toast.error('Load Error', 'Could not load your events for check-in.')
    } finally {
      setLoading(false)
    }
  }, [request, toast])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  const activeEvents = events.filter((event) => new Date(event.endAt).getTime() > clock)
  const visibleEvents = activeEvents.filter((event) => `${event.title} ${event.venue} ${event.city}`.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <DashboardShell role="ORGANIZER" pageTitle="Door Check-in Hub">
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 p-8 text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-widest opacity-80">Real-Time Door Console</p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">QR Ticket Check-in</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed opacity-90">
            Select an upcoming or in-progress event to open the door console and scan attendee tickets.
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-sm">
            <div className="rounded-lg bg-white/20 px-4 py-2 backdrop-blur-sm">
              <span className="font-bold">{activeEvents.length}</span>
              <span className="ml-1.5 opacity-90">event{activeEvents.length !== 1 ? 's' : ''} available</span>
            </div>
            <Link
              to="/organizer/events"
              className="rounded-lg bg-white/20 px-4 py-2 font-semibold backdrop-blur-sm transition hover:bg-white/30"
            >
              Manage events →
            </Link>
          </div>
        </div>

        {/* Event Selection */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Select Event for Check-in</h2>
              <p className="mt-1 text-sm text-slate-500">
                Upcoming and in-progress events appear here. Events past their scheduled end time are closed.
              </p>
            </div>
            {!loading && activeEvents.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {activeEvents.length} available
              </span>
            )}
          </div>

          {!loading && activeEvents.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
            <label className="sr-only" htmlFor="check-in-event-search">Search check-in events</label>
            <input id="check-in-event-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search event, venue, or city" className="h-10 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
            <span className="text-xs text-slate-500">{visibleEvents.length} available</span>
          </div>}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-amber-100 border-t-amber-500" />
              <p className="mt-3 text-sm text-slate-500">Loading your events…</p>
            </div>
          ) : activeEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-500">
                <IconCalendar className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">No Upcoming Events</h3>
              <p className="mt-2 max-w-sm text-sm text-slate-500">
                There are no upcoming or in-progress events available for check-in.
              </p>
              <Link
                to="/organizer/events"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Go to Events Studio →
              </Link>
            </div>
          ) : visibleEvents.length === 0 ? (
            <div className="p-10 text-center"><h3 className="m-0 text-base font-semibold text-slate-900">No events match that search</h3><p className="mb-0 mt-2 text-sm text-slate-500">Try another event name, venue, or city.</p></div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 transition hover:bg-slate-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <IconCamera className="h-5 w-5" />
                    </div>
                    <div>
                      <strong className="block text-sm font-bold text-slate-900">{event.title}</strong>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {event.venue} · {event.city} · {dateLabel(event.startAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${new Date(event.startAt).getTime() <= clock ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-indigo-200 bg-indigo-50 text-indigo-700'}`}>
                      <span className="relative flex h-1.5 w-1.5">
                        {new Date(event.startAt).getTime() <= clock && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
                        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${new Date(event.startAt).getTime() <= clock ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                      </span>
                      {new Date(event.startAt).getTime() <= clock ? 'In progress' : 'Upcoming'}
                    </span>
                    <Link
                      to={`/organizer/events/${event.id}/check-in`}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95"
                    >
                      <IconCamera className="h-3.5 w-3.5" />
                      Open Console
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* How-to hint */}
        {!loading && activeEvents.length > 0 && (
          <p className="text-center text-xs text-slate-400">
            Open the console on a phone or tablet at the venue entrance for best results. Camera permission is required for QR scanning.
          </p>
        )}
      </div>
    </DashboardShell>
  )
}
