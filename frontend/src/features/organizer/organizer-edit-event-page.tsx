import { AxiosError } from 'axios'
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { DashboardShell } from '../analytics/dashboard-shell'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { useToast } from '../../components/ui/toast'
import { ConfirmModal, PromptModal } from '../../components/ui/modal'
import { CoverImageUploader } from './components/cover-image-uploader'
import type { Category, EventRecord, TicketType } from './organizer-events-page'
import {
  IconCalendar,
  IconCamera,
  IconMapPin,
  IconPlus,
  IconTrash,
  IconUsers,
} from '../../components/ui/icons'

type TabKey = 'details' | 'tickets' | 'schedule' | 'overview'

export function OrganizerEditEventPage() {
  const { eventId = '' } = useParams()
  const navigate = useNavigate()
  const request = useAuthenticatedApi()
  const toast = useToast()

  const [event, setEvent] = useState<EventRecord | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('details')

  // Form states for general details
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [city, setCity] = useState('')
  const [venue, setVenue] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [timezone, setTimezone] = useState('Asia/Colombo')
  const [capacity, setCapacity] = useState('')
  const [savingDetails, setSavingDetails] = useState(false)

  // Subform states
  const [ticketForm, setTicketForm] = useState({
    name: '',
    price: '',
    currency: 'LKR',
    quantity: '',
  })
  const [addingTicket, setAddingTicket] = useState(false)

  const [sessionForm, setSessionForm] = useState({
    title: '',
    speaker: '',
    venue: '',
    startAt: '',
    endAt: '',
  })
  const [addingSession, setAddingSession] = useState(false)

  // Action modals
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)

  const loadEvent = useCallback(async () => {
    if (!eventId) return
    try {
      const [eventRes, catsRes] = await Promise.all([
        request<EventRecord>({ method: 'GET', url: `/organizer/events/${eventId}` }),
        request<Category[]>({ method: 'GET', url: '/categories' }),
      ])

      const data = eventRes.data
      setEvent(data)
      setCategories(catsRes.data)

      // Populate form
      setTitle(data.title)
      setDescription(data.description)
      setCategoryId(data.categoryId)
      setCity(data.city)
      setVenue(data.venue)
      setTimezone(data.timezone || 'Asia/Colombo')
      setCapacity(data.capacity?.toString() ?? '')

      // Format ISO dates to datetime-local
      const toLocal = (iso: string) => {
        const d = new Date(iso)
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
        return d.toISOString().slice(0, 16)
      }
      setStartAt(toLocal(data.startAt))
      setEndAt(toLocal(data.endAt))

      // Pre-fill session default times within event range
      setSessionForm((prev) => ({
        ...prev,
        startAt: toLocal(data.startAt),
        endAt: toLocal(data.endAt),
      }))
    } catch (err) {
      toast.error('Loading Error', 'Could not load event data.')
      navigate('/organizer/events')
    } finally {
      setLoading(false)
    }
  }, [eventId, navigate, request, toast])

  useEffect(() => {
    void loadEvent()
  }, [loadEvent])

  // Save Event Details
  async function handleSaveDetails(e: FormEvent) {
    e.preventDefault()
    if (!event) return

    const startDate = new Date(startAt)
    const endDate = new Date(endAt)
    if (endDate <= startDate) {
      toast.error('Invalid Date Range', 'End time must be after start time.')
      return
    }

    setSavingDetails(true)
    try {
      const changed: Record<string, unknown> = {}
      if (title.trim() !== event.title) changed.title = title.trim()
      if (description.trim() !== event.description) changed.description = description.trim()
      if (categoryId !== event.categoryId) changed.categoryId = categoryId
      if (city.trim() !== event.city) changed.city = city.trim()
      if (venue.trim() !== event.venue) changed.venue = venue.trim()
      if (timezone.trim() !== event.timezone) changed.timezone = timezone.trim()

      const newCap = capacity ? Number(capacity) : null
      if (newCap !== event.capacity) changed.capacity = newCap

      const newStartIso = startDate.toISOString()
      const newEndIso = endDate.toISOString()
      if (newStartIso !== new Date(event.startAt).toISOString()) changed.startAt = newStartIso
      if (newEndIso !== new Date(event.endAt).toISOString()) changed.endAt = newEndIso

      if (Object.keys(changed).length === 0) {
        toast.success('Up to Date', 'No changes detected.')
        setSavingDetails(false)
        return
      }

      await request({
        method: 'PATCH',
        url: `/organizer/events/${event.id}`,
        data: changed,
      })
      toast.success('Details Saved', 'Event metadata successfully updated.')
      await loadEvent()
    } catch (err) {
      const msg = err instanceof AxiosError ? err.response?.data?.message : undefined
      toast.error('Save Failed', typeof msg === 'string' ? msg : 'Please check your inputs and try again.')
    } finally {
      setSavingDetails(false)
    }
  }

  // Cover Image handlers
  async function handleUploadCoverNow(file: File) {
    if (!event) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      await request({
        method: 'POST',
        url: `/organizer/events/${event.id}/cover-image`,
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Cover Image Updated', 'New banner image applied to your event.')
      await loadEvent()
    } catch (err: unknown) {
      const msg = err instanceof AxiosError ? err.response?.data?.message : undefined
      toast.error('Upload Failed', typeof msg === 'string' ? msg : 'Use a JPEG, PNG, or WebP image under 5 MB.')
      throw err
    }
  }

  async function handleDeleteCoverNow() {
    if (!event) return
    try {
      await request({
        method: 'DELETE',
        url: `/organizer/events/${event.id}/cover-image`,
      })
      toast.success('Cover Reset', 'Banner image reset to default placeholder.')
      await loadEvent()
    } catch (err: unknown) {
      const msg = err instanceof AxiosError ? err.response?.data?.message : undefined
      toast.error('Reset Failed', typeof msg === 'string' ? msg : 'Could not reset cover image.')
      throw err
    }
  }

  // Publish / Unpublish Toggle
  async function handlePublishToggle(action: 'publish' | 'unpublish') {
    if (!event) return
    try {
      await request({ method: 'PATCH', url: `/organizer/events/${event.id}/${action}` })
      toast.success(
        action === 'publish' ? 'Event Published!' : 'Returned to Draft',
        action === 'publish'
          ? 'Your event is now live and public for registrations.'
          : 'The event is no longer publicly visible.',
      )
      await loadEvent()
    } catch {
      toast.error(
        'Action Failed',
        `Could not ${action} event. Ensure at least one active ticket tier is configured.`,
      )
    }
  }

  // Cancel Event
  async function handleCancelConfirm(reason: string) {
    if (!event) return
    setActionBusy(true)
    try {
      const res = await request<{ cancellationNoticesQueued: number }>({
        method: 'PATCH',
        url: `/organizer/events/${event.id}/cancel`,
        data: { reason },
      })
      toast.success('Event Cancelled', `${res.data.cancellationNoticesQueued} attendee notice(s) queued.`)
      setCancelModalOpen(false)
      await loadEvent()
    } catch {
      toast.error('Cancellation Error', 'Could not cancel event.')
    } finally {
      setActionBusy(false)
    }
  }

  // Delete Draft Event
  async function handleDeleteConfirm() {
    if (!event) return
    setActionBusy(true)
    try {
      await request({ method: 'DELETE', url: `/organizer/events/${event.id}` })
      toast.success('Event Deleted', 'The draft event has been removed.')
      navigate('/organizer/events')
    } catch {
      toast.error('Cannot Delete', 'Events with attendee registrations or sales cannot be deleted.')
      setActionBusy(false)
    }
  }

  // Ticket Tier management
  async function handleAddTicket(e: FormEvent) {
    e.preventDefault()
    if (!event) return
    setAddingTicket(true)
    try {
      await request({
        method: 'POST',
        url: `/organizer/events/${event.id}/ticket-types`,
        data: {
          name: ticketForm.name.trim(),
          price: ticketForm.price.trim(),
          currency: ticketForm.currency.trim().toUpperCase() || 'LKR',
          quantity: Number(ticketForm.quantity),
        },
      })
      toast.success('Ticket Tier Added', `Created ${ticketForm.name} tier.`)
      setTicketForm({ name: '', price: '', currency: 'LKR', quantity: '' })
      await loadEvent()
    } catch {
      toast.error('Ticket Error', 'Verify that price and quantity are valid.')
    } finally {
      setAddingTicket(false)
    }
  }

  async function handleToggleTicketActive(item: TicketType) {
    if (!event) return
    try {
      await request({
        method: 'PATCH',
        url: `/organizer/events/${event.id}/ticket-types/${item.id}/activation`,
        data: { isActive: !item.isActive },
      })
      toast.success('Ticket Status Updated', `${item.name} is now ${!item.isActive ? 'active' : 'paused'}.`)
      await loadEvent()
    } catch {
      toast.error('Update Failed', 'Ticket status could not be changed.')
    }
  }

  async function handleDeleteTicket(id: string) {
    if (!event) return
    try {
      await request({ method: 'DELETE', url: `/organizer/events/${event.id}/ticket-types/${id}` })
      toast.success('Ticket Tier Removed', 'Tier deleted successfully.')
      await loadEvent()
    } catch {
      toast.error('Delete Failed', 'Cannot delete ticket types with active registration or sales history.')
    }
  }

  // Session / Agenda management
  async function handleAddSession(e: FormEvent) {
    e.preventDefault()
    if (!event) return
    setAddingSession(true)
    try {
      await request({
        method: 'POST',
        url: `/organizer/events/${event.id}/sessions`,
        data: {
          title: sessionForm.title.trim(),
          speaker: sessionForm.speaker.trim() || null,
          venue: sessionForm.venue.trim() || null,
          startAt: new Date(sessionForm.startAt).toISOString(),
          endAt: new Date(sessionForm.endAt).toISOString(),
        },
      })
      toast.success('Session Added', 'Agenda schedule entry recorded.')
      setSessionForm((prev) => ({ ...prev, title: '', speaker: '', venue: '' }))
      await loadEvent()
    } catch {
      toast.error('Schedule Error', 'Session times must fall within the event duration.')
    } finally {
      setAddingSession(false)
    }
  }

  async function handleDeleteSession(id: string) {
    if (!event) return
    try {
      await request({ method: 'DELETE', url: `/organizer/events/${event.id}/sessions/${id}` })
      toast.success('Session Removed', 'Schedule entry deleted.')
      await loadEvent()
    } catch {
      toast.error('Delete Failed', 'Could not delete session.')
    }
  }

  if (loading) {
    return (
      <DashboardShell role="ORGANIZER" pageTitle="Manage Event">
        <div className="flex min-h-[400px] flex-col items-center justify-center p-12 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-indigo-100 border-t-indigo-600" />
          <p className="mt-3 text-sm font-medium text-slate-500">Loading event configuration…</p>
        </div>
      </DashboardShell>
    )
  }

  if (!event) return null

  const totalTicketsSold = event.ticketTypes?.reduce((sum, t) => sum + (t.quantitySold || 0), 0) ?? event.ticketsSold ?? 0

  return (
    <DashboardShell role="ORGANIZER" pageTitle={`Manage: ${event.title}`}>
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link to="/organizer/events" className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline">
            ← Events Studio
          </Link>
          <span>/</span>
          <span className="truncate font-medium text-slate-800">{event.title}</span>
        </div>

        {/* Top Header Card with Quick Actions */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                    event.status === 'PUBLISHED'
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                      : event.status === 'DRAFT'
                        ? 'border border-amber-200 bg-amber-50 text-amber-700'
                        : 'border border-rose-200 bg-rose-50 text-rose-700'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      event.status === 'PUBLISHED'
                        ? 'bg-emerald-500'
                        : event.status === 'DRAFT'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                    }`}
                  />
                  {event.status.toLowerCase()}
                </span>
                {event.category && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {event.category.name}
                  </span>
                )}
                <span className="text-xs text-slate-500">
                  {event.ticketTypes.length} ticket tier(s) · {event.sessions.length} session(s)
                </span>
              </div>

              <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                {event.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
                <div className="flex items-center gap-1">
                  <IconCalendar className="h-3.5 w-3.5 text-indigo-500" />
                  <span>{new Date(event.startAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <IconMapPin className="h-3.5 w-3.5 text-indigo-500" />
                  <span>{event.venue}, {event.city}</span>
                </div>
              </div>
            </div>

            {/* Quick Action Button Strip */}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/events/${event.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 active:scale-98"
              >
                <span>View Public Page</span>
                <span className="text-slate-400">↗</span>
              </Link>

              <Link
                to={`/organizer/events/${event.id}/check-in`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 active:scale-98"
              >
                <IconCamera className="h-4 w-4 text-indigo-600" />
                <span>Check-in Console</span>
              </Link>

              {event.status === 'DRAFT' && (
                <button
                  type="button"
                  onClick={() => void handlePublishToggle('publish')}
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:from-emerald-700 hover:to-emerald-800 active:scale-98"
                >
                  Publish Event
                </button>
              )}

              {event.status === 'PUBLISHED' && (
                <button
                  type="button"
                  onClick={() => void handlePublishToggle('unpublish')}
                  className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100 active:scale-98"
                >
                  Unpublish to Draft
                </button>
              )}

              {event.status !== 'CANCELLED' && event.status !== 'COMPLETED' && (
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(true)}
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                >
                  Cancel Event
                </button>
              )}

              {event.status === 'DRAFT' && (
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(true)}
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-rose-600"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-4 rounded-2xl shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`border-b-2 px-5 py-3.5 text-sm font-bold transition-all ${
              activeTab === 'details'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Details & Banner
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tickets')}
            className={`flex items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-bold transition-all ${
              activeTab === 'tickets'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Tickets & Inventory</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {event.ticketTypes.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-bold transition-all ${
              activeTab === 'schedule'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Schedule / Agenda</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {event.sessions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`border-b-2 px-5 py-3.5 text-sm font-bold transition-all ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Performance & Sales
          </button>
        </div>

        {/* Tab 1: Details & Cover Banner */}
        {activeTab === 'details' && (
          <div className="space-y-6">
            {/* Dedicated Cover Banner Section */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
              <div className="mb-4">
                <h2 className="text-base font-bold text-slate-900">Event Cover Banner</h2>
                <p className="text-xs text-slate-500">
                  Upload or replace your event's banner image. It appears in event discovery, social previews, and registration screens.
                </p>
              </div>

              <CoverImageUploader
                currentImageUrl={event.coverImageUrl}
                onFileSelect={() => {}}
                onUploadNow={handleUploadCoverNow}
                onDeleteCurrent={handleDeleteCoverNow}
                fallbackTitle={event.title}
              />
            </div>

            {/* Event Logistics Metadata Form */}
            <form onSubmit={handleSaveDetails} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-5">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900">Event Information & Logistics</h2>
                <p className="text-xs text-slate-500">
                  Update event title, categorization, timing, and venue specifics.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Event Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Capacity (Optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    placeholder="Unlimited"
                    className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={6}
                  maxLength={20000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Starts At <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Ends At <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    City <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Venue / Hall <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">Timezone</label>
                  <input
                    type="text"
                    required
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  disabled={savingDetails}
                  className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-indigo-700 active:scale-98 disabled:opacity-50"
                >
                  {savingDetails ? 'Saving Changes…' : 'Save Event Details'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: Tickets & Inventory */}
        {activeTab === 'tickets' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Configured Ticket Tiers</h2>
                  <p className="text-xs text-slate-500">
                    Manage pricing, pause sales, or add tiers for VIP, Early Birds, or general attendees.
                  </p>
                </div>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                  {event.ticketTypes.length} Active & Draft Tiers
                </span>
              </div>

              {event.ticketTypes.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  No ticket tiers added yet. Create one below to allow registrations.
                </div>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {event.ticketTypes.map((t) => (
                    <div
                      key={t.id}
                      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4 shadow-xs transition hover:border-indigo-200 hover:bg-white"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <strong className="text-sm font-bold text-slate-900">{t.name}</strong>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              t.isActive
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {t.isActive ? 'Active' : 'Paused'}
                          </span>
                        </div>

                        <div className="mt-2 text-xl font-extrabold text-indigo-600">
                          {t.currency} {Number(t.price).toLocaleString()}
                        </div>

                        <div className="mt-2 text-xs text-slate-500">
                          Sold / Reserved: {t.quantitySold + t.quantityReserved} / {t.quantity}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-3">
                        <button
                          type="button"
                          onClick={() => void handleToggleTicketActive(t)}
                          className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
                        >
                          {t.isActive ? 'Pause Sales' : 'Resume Sales'}
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleDeleteTicket(t.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          title="Delete tier"
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Ticket Tier Form */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
              <h3 className="text-base font-bold text-slate-900">Add New Ticket Tier</h3>
              <p className="text-xs text-slate-500">
                Provide tier name, price, and allocated capacity.
              </p>

              <form onSubmit={handleAddTicket} className="mt-4">
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700">Tier Name</label>
                    <input
                      type="text"
                      required
                      value={ticketForm.name}
                      onChange={(e) => setTicketForm({ ...ticketForm, name: e.target.value })}
                      placeholder="e.g. VIP Access, Student Pass"
                      className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700">Price ({ticketForm.currency})</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={ticketForm.price}
                      onChange={(e) => setTicketForm({ ...ticketForm, price: e.target.value })}
                      placeholder="0 for Free"
                      className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={ticketForm.quantity}
                      onChange={(e) => setTicketForm({ ...ticketForm, quantity: e.target.value })}
                      placeholder="100"
                      className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={addingTicket}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-indigo-700 active:scale-98 disabled:opacity-50"
                  >
                    <IconPlus className="h-4 w-4" />
                    <span>{addingTicket ? 'Adding…' : 'Add Ticket Tier'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tab 3: Schedule & Agenda */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base font-bold text-slate-900">Event Schedule & Agenda</h2>
                <p className="text-xs text-slate-500">
                  Outline session timelines, keynotes, and room allocations.
                </p>
              </div>

              {event.sessions.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  No agenda sessions recorded yet. Add one below.
                </div>
              ) : (
                <div className="mt-5 divide-y divide-slate-100">
                  {event.sessions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-4">
                      <div>
                        <strong className="block text-sm font-bold text-slate-900">{s.title}</strong>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span>
                            {new Date(s.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                            {new Date(s.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {s.speaker && <span className="font-medium text-slate-700">· Speaker: {s.speaker}</span>}
                          {s.venue && <span className="text-slate-600">· Room: {s.venue}</span>}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleDeleteSession(s.id)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title="Delete session"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Session Form */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
              <h3 className="text-base font-bold text-slate-900">Add Agenda Session</h3>
              <form onSubmit={handleAddSession} className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">Session Title</label>
                    <input
                      type="text"
                      required
                      value={sessionForm.title}
                      onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                      placeholder="e.g. Opening Keynote & Fireside Chat"
                      className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700">Speaker / Host (Optional)</label>
                    <input
                      type="text"
                      value={sessionForm.speaker}
                      onChange={(e) => setSessionForm({ ...sessionForm, speaker: e.target.value })}
                      placeholder="e.g. Dr. Jane Doe"
                      className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">Start Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={sessionForm.startAt}
                      onChange={(e) => setSessionForm({ ...sessionForm, startAt: e.target.value })}
                      className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700">End Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={sessionForm.endAt}
                      onChange={(e) => setSessionForm({ ...sessionForm, endAt: e.target.value })}
                      className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700">Stage / Room (Optional)</label>
                    <input
                      type="text"
                      value={sessionForm.venue}
                      onChange={(e) => setSessionForm({ ...sessionForm, venue: e.target.value })}
                      placeholder="e.g. Hall B"
                      className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={addingSession}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-indigo-700 active:scale-98 disabled:opacity-50"
                  >
                    <IconPlus className="h-4 w-4" />
                    <span>{addingSession ? 'Adding…' : 'Add Session Entry'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tab 4: Performance & Sales */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <span className="text-xs font-bold uppercase text-slate-500">Tickets Issued</span>
                <strong className="mt-2 block text-2xl font-black text-slate-900">
                  {totalTicketsSold}
                  {event.capacity ? <span className="text-sm font-normal text-slate-500"> / {event.capacity}</span> : ''}
                </strong>
                <span className="mt-1 block text-xs text-slate-500">Across {event.ticketTypes.length} tiers</span>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <span className="text-xs font-bold uppercase text-slate-500">Door Check-in</span>
                <Link
                  to={`/organizer/events/${event.id}/check-in`}
                  className="mt-2 inline-flex items-center gap-1.5 text-lg font-bold text-indigo-600 hover:underline"
                >
                  <IconCamera className="h-5 w-5" />
                  <span>Open Console →</span>
                </Link>
                <span className="mt-1 block text-xs text-slate-500">Fast QR and ticket reference check-in</span>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <span className="text-xs font-bold uppercase text-slate-500">Attendee Records</span>
                <Link
                  to={`/organizer/participants?event=${encodeURIComponent(event.id)}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-lg font-bold text-indigo-600 hover:underline"
                >
                  <IconUsers className="h-5 w-5" />
                  <span>View Attendee List →</span>
                </Link>
                <span className="mt-1 block text-xs text-slate-500">Export roster and inspect tickets</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Full Sales & Revenue Analytics</h3>
                  <p className="text-xs text-slate-500">
                    Dive into verified payments, registration trends, and attendance tracking.
                  </p>
                </div>
                <Link
                  to={`/organizer/sales/${event.id}`}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700"
                >
                  Open Sales Report →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Action Modals */}
        <PromptModal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          onConfirm={handleCancelConfirm}
          title="Cancel This Event?"
          message="Canceling stops ticket bookings and delivers notices to all registered attendees."
          label="Reason for attendees"
          placeholder="Please explain reason for cancellation"
          minLength={5}
          loading={actionBusy}
        />

        <ConfirmModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleDeleteConfirm}
          title="Delete Draft Event?"
          message="Are you sure you want to permanently delete this draft event?"
          destructive
          confirmText="Delete Event"
          loading={actionBusy}
        />
      </div>
    </DashboardShell>
  )
}
