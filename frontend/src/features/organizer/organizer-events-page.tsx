import { AxiosError } from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { DashboardShell } from '../analytics/dashboard-shell'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { useToast } from '../../components/ui/toast'
import { ConfirmModal, PromptModal } from '../../components/ui/modal'
import { getEventPlaceholder } from '../../lib/placeholders'
import {
  IconCalendar,
  IconMapPin,
  IconPlus,
  IconSearch,
  IconTicket,
  IconCamera,
  IconSparkles,
} from '../../components/ui/icons'

export type TicketType = {
  id: string
  name: string
  price: string
  currency: string
  quantity: number
  quantityReserved: number
  quantitySold: number
  isActive: boolean
}

export type Session = {
  id: string
  title: string
  startAt: string
  endAt: string
  venue: string | null
  speaker: string | null
}

export type Category = { id: string; name: string; slug?: string }

export type EventRecord = {
  id: string
  title: string
  description: string
  categoryId: string
  category?: Category
  venue: string
  city: string
  startAt: string
  endAt: string
  timezone: string
  capacity: number | null
  ticketsSold?: number
  ticketsReserved?: number
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED'
  coverImageUrl: string | null
  ticketTypes: TicketType[]
  sessions: Session[]
}

const statusBadgeClasses: Record<string, string> = {
  PUBLISHED: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  DRAFT: 'border border-amber-200 bg-amber-50 text-amber-700',
  CANCELLED: 'border border-rose-200 bg-rose-50 text-rose-700',
  COMPLETED: 'border border-slate-200 bg-slate-100 text-slate-700',
}

const statusDotClasses: Record<string, string> = {
  PUBLISHED: 'bg-emerald-500',
  DRAFT: 'bg-amber-500',
  CANCELLED: 'bg-rose-500',
  COMPLETED: 'bg-slate-400',
}

export function OrganizerEventsPage() {
  const request = useAuthenticatedApi()
  const toast = useToast()

  const [events, setEvents] = useState<EventRecord[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // Filters & Search
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT' | 'CANCELLED' | 'COMPLETED'>('ALL')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  // Modals for actions
  const [cancelModalEvent, setCancelModalEvent] = useState<EventRecord | null>(null)
  const [deleteModalEvent, setDeleteModalEvent] = useState<EventRecord | null>(null)
  const [actionBusy, setActionBusy] = useState(false)

  const fetchEvents = useCallback(async () => {
    try {
      const [eventsRes, catsRes] = await Promise.all([
        request<EventRecord[]>({ method: 'GET', url: '/organizer/events' }),
        request<Category[]>({ method: 'GET', url: '/categories' }),
      ])
      setEvents(eventsRes.data)
      setCategories(catsRes.data)
    } catch (err) {
      toast.error(
        'Loading Error',
        err instanceof AxiosError && err.response?.status === 403
          ? 'Organizer access requires an approved application.'
          : 'Could not load your events.',
      )
    } finally {
      setLoading(false)
    }
  }, [request, toast])

  useEffect(() => {
    void fetchEvents()
  }, [fetchEvents])

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (statusFilter !== 'ALL' && ev.status !== statusFilter) return false
      if (categoryFilter && ev.categoryId !== categoryFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const text = `${ev.title} ${ev.city} ${ev.venue} ${ev.category?.name ?? ''}`.toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })
  }, [events, statusFilter, categoryFilter, search])

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const total = events.length
    const published = events.filter((e) => e.status === 'PUBLISHED').length
    const drafts = events.filter((e) => e.status === 'DRAFT').length
    const totalSold = events.reduce((sum, e) => {
      const fromTypes = e.ticketTypes?.reduce((tSum, t) => tSum + (t.quantitySold || 0), 0) ?? 0
      return sum + (e.ticketsSold ?? fromTypes)
    }, 0)
    return { total, published, drafts, totalSold }
  }, [events])

  // Status counts for filter pills
  const statusCounts = useMemo(() => {
    return {
      ALL: events.length,
      PUBLISHED: events.filter((e) => e.status === 'PUBLISHED').length,
      DRAFT: events.filter((e) => e.status === 'DRAFT').length,
      CANCELLED: events.filter((e) => e.status === 'CANCELLED').length,
      COMPLETED: events.filter((e) => e.status === 'COMPLETED').length,
    }
  }, [events])

  async function handlePublishToggle(event: EventRecord, action: 'publish' | 'unpublish') {
    try {
      await request({ method: 'PATCH', url: `/organizer/events/${event.id}/${action}` })
      toast.success(
        action === 'publish' ? 'Event Published!' : 'Returned to Draft',
        action === 'publish'
          ? 'Your event is now live and public for attendees to discover and register.'
          : 'The event is no longer publicly visible.',
      )
      await fetchEvents()
    } catch {
      toast.error(
        'Action Failed',
        `Could not ${action} event. Ensure at least one active ticket tier is configured.`,
      )
    }
  }

  async function handleCancelConfirm(reason: string) {
    if (!cancelModalEvent) return
    setActionBusy(true)
    try {
      const response = await request<{ cancellationNoticesQueued: number }>({
        method: 'PATCH',
        url: `/organizer/events/${cancelModalEvent.id}/cancel`,
        data: { reason },
      })
      toast.success(
        'Event Cancelled',
        `${response.data.cancellationNoticesQueued} attendee notice(s) queued for delivery.`,
      )
      setCancelModalEvent(null)
      await fetchEvents()
    } catch {
      toast.error('Cancellation Error', 'Could not cancel event.')
    } finally {
      setActionBusy(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteModalEvent) return
    setActionBusy(true)
    try {
      await request({ method: 'DELETE', url: `/organizer/events/${deleteModalEvent.id}` })
      toast.success('Event Deleted', 'The draft event has been removed.')
      setDeleteModalEvent(null)
      await fetchEvents()
    } catch {
      toast.error('Cannot Delete', 'Events with attendee registrations or sales cannot be deleted.')
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <DashboardShell role="ORGANIZER" pageTitle="Events Studio">
      <div className="space-y-6">
        {/* Top Header & Primary Action */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Organizer Workspace
              </span>
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                {events.length} {events.length === 1 ? 'event' : 'events'}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Events Management
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Create and manage experiences, oversee ticket inventory, upload banner media, and track admissions.
            </p>
          </div>

          <Link
            to="/organizer/events/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-3 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all duration-200 hover:from-indigo-700 hover:to-indigo-800 hover:shadow-lg hover:shadow-indigo-300 active:scale-98"
          >
            <IconPlus className="h-5 w-5" />
            <span>Create New Event</span>
          </Link>
        </div>

        {/* Overview Metric Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition hover:shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Events</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <IconCalendar className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{metrics.total}</div>
            <p className="mt-1 text-xs text-slate-500">All registered experiences</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition hover:shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Live & Published</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <IconSparkles className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-emerald-600">{metrics.published}</div>
            <p className="mt-1 text-xs text-slate-500">Publicly discoverable</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition hover:shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Drafts</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <IconCalendar className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-amber-600">{metrics.drafts}</div>
            <p className="mt-1 text-xs text-slate-500">Setup in progress</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition hover:shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Tickets Sold</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <IconTicket className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{metrics.totalSold}</div>
            <p className="mt-1 text-xs text-slate-500">Across all ticket tiers</p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Status Pills */}
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
              {(['ALL', 'PUBLISHED', 'DRAFT', 'CANCELLED', 'COMPLETED'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                    statusFilter === status
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                  }`}
                >
                  <span>{status === 'ALL' ? 'All Events' : status.charAt(0) + status.slice(1).toLowerCase()}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      statusFilter === status ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {statusCounts[status]}
                  </span>
                </button>
              ))}
            </div>

            {/* Search, Category & View Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search events, venues..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-full rounded-xl border border-slate-300 bg-slate-50/50 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:w-56"
                />
              </div>

              <select
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* View Toggle */}
              <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-0.5">
                <button
                  type="button"
                  title="Grid view"
                  onClick={() => setViewMode('grid')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    viewMode === 'grid' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Grid
                </button>
                <button
                  type="button"
                  title="Table view"
                  onClick={() => setViewMode('table')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    viewMode === 'table' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Table
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-indigo-100 border-t-indigo-600" />
            <p className="mt-3 text-sm font-medium text-slate-500">Loading your events studio…</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <IconCalendar className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">
              {events.length === 0 ? 'No events created yet' : 'No matching events found'}
            </h3>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              {events.length === 0
                ? 'Get started by creating your first event draft. You can configure tickets, upload banner images, and set schedules before publishing.'
                : 'Try adjusting your search keywords, clearing status filters, or resetting the category selection.'}
            </p>
            {events.length === 0 ? (
              <Link
                to="/organizer/events/new"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700"
              >
                <IconPlus className="h-4 w-4" />
                Create Your First Event
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('ALL')
                  setCategoryFilter('')
                }}
                className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* Cards Grid View */
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filteredEvents.map((ev) => {
              const startDate = new Date(ev.startAt)
              const totalSold = ev.ticketTypes?.reduce((sum, t) => sum + (t.quantitySold || 0), 0) ?? ev.ticketsSold ?? 0
              const capacity = ev.capacity
              const soldPercentage = capacity ? Math.min(100, Math.round((totalSold / capacity) * 100)) : null
              const coverUrl = ev.coverImageUrl || getEventPlaceholder(ev.title)

              return (
                <div
                  key={ev.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                >
                  {/* Card Banner Media */}
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                    <img
                      src={coverUrl}
                      alt={ev.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-black/20" />

                    {/* Status & Category Badges */}
                    <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-xs backdrop-blur-md ${
                          statusBadgeClasses[ev.status] ?? 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${statusDotClasses[ev.status] ?? 'bg-slate-400'}`} />
                        {ev.status.toLowerCase()}
                      </span>
                      {ev.category && (
                        <span className="inline-flex rounded-full bg-slate-900/60 px-2 py-0.5 text-[10px] font-semibold text-slate-200 backdrop-blur-md">
                          {ev.category.name}
                        </span>
                      )}
                    </div>

                    {/* City Tag in Banner */}
                    <div className="absolute bottom-2.5 left-3 flex items-center gap-1 text-xs font-semibold text-white/90">
                      <IconMapPin className="h-3.5 w-3.5 text-indigo-400" />
                      <span>{ev.city}</span>
                    </div>
                  </div>

                  {/* Card Info */}
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      <IconCalendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        {startDate.toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}{' '}
                        ·{' '}
                        {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <h2 className="mt-2 text-base font-bold text-slate-900 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                      {ev.title}
                    </h2>

                    <p className="mt-1 text-xs text-slate-500 line-clamp-1">
                      {ev.venue}
                    </p>

                    {/* Ticket Capacity Bar */}
                    <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-600">Tickets Sold</span>
                        <span className="font-bold text-slate-900">
                          {totalSold}
                          {capacity ? <span className="font-normal text-slate-500"> / {capacity}</span> : ' sold'}
                        </span>
                      </div>
                      {soldPercentage !== null && (
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                            style={{ width: `${soldPercentage}%` }}
                          />
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{ev.ticketTypes?.length ?? 0} ticket tier(s)</span>
                        <span>{ev.sessions?.length ?? 0} session(s)</span>
                      </div>
                    </div>

                    {/* Actions Strip */}
                    <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                      <Link
                        to={`/organizer/events/${ev.id}/edit`}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-indigo-700 active:scale-98"
                      >
                        Manage & Edit
                      </Link>

                      <Link
                        to={`/organizer/events/${ev.id}/check-in`}
                        title="Door Check-in Console"
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 active:scale-98"
                      >
                        <IconCamera className="h-4 w-4" />
                      </Link>

                      <Link
                        to={`/organizer/sales/${ev.id}`}
                        title="Sales Report"
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 active:scale-98"
                      >
                        <IconTicket className="h-4 w-4" />
                      </Link>

                      {/* Dropdown / Quick Actions */}
                      <div className="flex items-center gap-1">
                        {ev.status === 'DRAFT' && (
                          <button
                            type="button"
                            onClick={() => void handlePublishToggle(ev, 'publish')}
                            className="rounded-xl bg-emerald-50 px-2.5 py-2 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100"
                          >
                            Publish
                          </button>
                        )}
                        {ev.status === 'PUBLISHED' && (
                          <button
                            type="button"
                            onClick={() => void handlePublishToggle(ev, 'unpublish')}
                            className="rounded-xl bg-amber-50 px-2.5 py-2 text-[11px] font-bold text-amber-700 transition hover:bg-amber-100"
                          >
                            Draft
                          </button>
                        )}
                        {ev.status !== 'CANCELLED' && ev.status !== 'COMPLETED' && (
                          <button
                            type="button"
                            onClick={() => setCancelModalEvent(ev)}
                            className="rounded-xl px-2 py-2 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50"
                          >
                            Cancel
                          </button>
                        )}
                        {ev.status === 'DRAFT' && (
                          <button
                            type="button"
                            onClick={() => setDeleteModalEvent(ev)}
                            className="rounded-xl px-2 py-2 text-[11px] font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-rose-600"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Table List View */
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Event</th>
                    <th className="px-4 py-3.5">Date & Venue</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Tickets Sold</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEvents.map((ev) => {
                    const totalSold = ev.ticketTypes?.reduce((sum, t) => sum + (t.quantitySold || 0), 0) ?? ev.ticketsSold ?? 0
                    const coverUrl = ev.coverImageUrl || getEventPlaceholder(ev.title)

                    return (
                      <tr key={ev.id} className="transition hover:bg-slate-50/70">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3.5">
                            <img
                              src={coverUrl}
                              alt=""
                              className="h-12 w-20 shrink-0 rounded-lg object-cover shadow-xs"
                            />
                            <div>
                              <Link
                                to={`/organizer/events/${ev.id}/edit`}
                                className="font-bold text-slate-900 hover:text-indigo-600"
                              >
                                {ev.title}
                              </Link>
                              <div className="mt-0.5 text-xs text-slate-500">
                                {ev.category?.name ?? 'General'} · {ev.ticketTypes?.length ?? 0} ticket tier(s)
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-xs text-slate-600">
                          <strong className="block text-slate-800">
                            {new Date(ev.startAt).toLocaleDateString()}
                          </strong>
                          <span>
                            {ev.city} · {ev.venue}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              statusBadgeClasses[ev.status] ?? 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${statusDotClasses[ev.status] ?? 'bg-slate-400'}`} />
                            {ev.status.toLowerCase()}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-xs text-slate-700">
                          <strong className="block text-sm font-bold text-slate-900">{totalSold}</strong>
                          <span className="text-slate-500">
                            {ev.capacity ? `of ${ev.capacity} capacity` : 'tickets sold'}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              to={`/organizer/events/${ev.id}/edit`}
                              className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                            >
                              Manage
                            </Link>
                            <Link
                              to={`/organizer/events/${ev.id}/check-in`}
                              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                              title="Check-in Console"
                            >
                              <IconCamera className="h-4 w-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Cancellation Reason Modal */}
        <PromptModal
          isOpen={Boolean(cancelModalEvent)}
          onClose={() => setCancelModalEvent(null)}
          onConfirm={handleCancelConfirm}
          title={`Cancel "${cancelModalEvent?.title}"?`}
          message="Canceling this event halts ticket sales immediately and queues cancellation notices to all registered attendees."
          label="Reason for cancellation"
          placeholder="e.g. Unforeseen weather conditions, venue unavailability..."
          minLength={5}
          loading={actionBusy}
        />

        {/* Delete Draft Modal */}
        <ConfirmModal
          isOpen={Boolean(deleteModalEvent)}
          onClose={() => setDeleteModalEvent(null)}
          onConfirm={handleDeleteConfirm}
          title={`Delete "${deleteModalEvent?.title}"?`}
          message="Are you sure you want to permanently delete this draft event? This cannot be undone."
          destructive
          confirmText="Delete Draft"
          loading={actionBusy}
        />
      </div>
    </DashboardShell>
  )
}
