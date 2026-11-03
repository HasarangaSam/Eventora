import { AxiosError } from 'axios'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { DashboardShell } from '../analytics/dashboard-shell'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { useToast } from '../../components/ui/toast'
import { CoverImageUploader } from './components/cover-image-uploader'
import {
  IconSparkles,
  IconCheck,
} from '../../components/ui/icons'

type Category = { id: string; name: string }

export function OrganizerCreateEventPage() {
  const request = useAuthenticatedApi()
  const toast = useToast()
  const navigate = useNavigate()

  const [categories, setCategories] = useState<Category[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Cover image file state
  const [coverFile, setCoverFile] = useState<File | null>(null)

  // Event form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [city, setCity] = useState('')
  const [venue, setVenue] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [timezone, setTimezone] = useState('Asia/Colombo')
  const [capacity, setCapacity] = useState('')

  // Optional initial ticket tier
  const [includeTicket, setIncludeTicket] = useState(true)
  const [ticketName, setTicketName] = useState('General Admission')
  const [ticketPrice, setTicketPrice] = useState('1500')
  const [ticketCurrency] = useState('LKR')
  const [ticketQuantity, setTicketQuantity] = useState('100')

  // Publish immediately option
  const [publishImmediately, setPublishImmediately] = useState(false)

  // Fetch categories on mount
  useEffect(() => {
    let active = true
    request<Category[]>({ method: 'GET', url: '/categories' })
      .then(({ data }) => {
        if (!active) return
        setCategories(data)
        if (data[0]) setCategoryId(data[0].id)
      })
      .catch(() => {
        toast.error('Categories Error', 'Could not load event categories.')
      })
      .finally(() => {
        if (active) setLoadingCategories(false)
      })
    return () => {
      active = false
    }
  }, [request, toast])

  // Provide initial sensible default dates (Tomorrow 10:00 AM to 18:00 PM)
  useEffect(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(10, 0, 0, 0)
    const localStart = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

    const end = new Date(tomorrow)
    end.setHours(18, 0, 0, 0)
    const localEnd = new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

    setStartAt(localStart)
    setEndAt(localEnd)
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !description.trim() || !categoryId || !venue.trim() || !city.trim() || !startAt || !endAt) {
      toast.error('Validation Error', 'Please fill in all required event details.')
      return
    }

    const startDate = new Date(startAt)
    const endDate = new Date(endAt)
    if (endDate <= startDate) {
      toast.error('Invalid Date Range', 'The event end time must be after the start time.')
      return
    }

    if (includeTicket) {
      if (!ticketName.trim() || !ticketPrice.trim() || !ticketQuantity.trim()) {
        toast.error('Ticket Details Required', 'Please complete the initial ticket tier or uncheck it.')
        return
      }
      const qty = Number(ticketQuantity)
      if (!Number.isInteger(qty) || qty < 1) {
        toast.error('Invalid Ticket Quantity', 'Ticket quantity must be at least 1.')
        return
      }
      const priceNum = Number(ticketPrice)
      if (isNaN(priceNum) || priceNum <= 0) {
        toast.error('Invalid Ticket Price', 'Ticket price must be greater than 0.')
        return
      }
    }

    if (publishImmediately && !includeTicket) {
      toast.error('Paid ticket required', 'Publishing requires at least one active paid ticket tier. Add your first tier or save this event as a draft.')
      return
    }

    setSubmitting(true)
    try {
      // 1. Create the event
      const payload = {
        title: title.trim(),
        description: description.trim(),
        categoryId: categoryId.trim(),
        venue: venue.trim(),
        city: city.trim(),
        startAt: startDate.toISOString(),
        endAt: endDate.toISOString(),
        timezone: timezone.trim(),
        capacity: capacity ? Number(capacity) : null,
      }

      const createResponse = await request<{ id: string }>({
        method: 'POST',
        url: '/organizer/events',
        data: payload,
      })
      const eventId = createResponse.data.id
      const setupIssues: string[] = []
      let ticketCreated = false

      // 2. Upload cover image if provided
      if (coverFile) {
        try {
          const formData = new FormData()
          formData.append('file', coverFile)
          await request({
            method: 'POST',
            url: `/organizer/events/${eventId}/cover-image`,
            data: formData,
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        } catch {
          setupIssues.push('The banner upload failed. You can retry it from the event editor.')
        }
      }

      // 3. Create initial ticket tier if specified
      if (includeTicket) {
        try {
          await request({
            method: 'POST',
            url: `/organizer/events/${eventId}/ticket-types`,
            data: {
              name: ticketName.trim(),
              price: ticketPrice.trim(),
              currency: ticketCurrency.trim().toUpperCase() || 'LKR',
              quantity: Number(ticketQuantity),
            },
          })
          ticketCreated = true
        } catch (err) {
          const message = err instanceof AxiosError ? err.response?.data?.message : undefined
          setupIssues.push(typeof message === 'string' ? `The ticket tier was not saved: ${message}` : 'The ticket tier was not saved. Retry setup from the event editor.')
        }
      }

      // 4. Publish if selected
      let published = false
      if (publishImmediately && ticketCreated) {
        try {
          await request({
            method: 'PATCH',
            url: `/organizer/events/${eventId}/publish`,
          })
          published = true
        } catch (err) {
          const data = err instanceof AxiosError ? err.response?.data : undefined
          const issues = Array.isArray(data?.issues) ? (data.issues as { message?: string }[]).map((issue) => issue.message).filter(Boolean).join(' ') : ''
          const message = typeof data?.message === 'string' ? data.message : issues
          setupIssues.push(message || 'The event could not be published yet. Review the readiness checklist in the editor.')
        }
      } else if (publishImmediately) {
        setupIssues.push('Publishing was skipped because the paid ticket tier still needs to be saved.')
      }

      if (published && setupIssues.length) toast.warning('Event published with an item to fix', setupIssues.join(' '))
      else if (published) toast.success('Event published', 'Your event is now live and open for registration.')
      else if (setupIssues.length) toast.warning('Draft saved with setup to finish', setupIssues.join(' '))
      else toast.success('Draft saved', 'You can continue setup and publish it from the event editor.')

      // Redirect to the dedicated management page for this event
      navigate(`/organizer/events/${eventId}/edit`)
    } catch (err) {
      const data = err instanceof AxiosError ? err.response?.data : undefined
      const apiMessage = Array.isArray(data?.message)
        ? data.message.join(', ')
        : typeof data?.message === 'string'
          ? data.message
          : data?.error || (err instanceof Error ? err.message : undefined)
      console.error('Event creation failed:', err, data)
      toast.error(
        'Creation Failed',
        typeof apiMessage === 'string' ? apiMessage : 'Could not create event. Please verify all fields.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardShell role="ORGANIZER" pageTitle="Create New Event">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link to="/organizer/events" className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline">
            ← Events Studio
          </Link>
          <span>/</span>
          <span className="text-slate-800">New Event</span>
        </div>

        {/* Header Strip */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="flex flex-col gap-2">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
              <IconSparkles className="h-3.5 w-3.5 text-indigo-500" />
              Event Creation Wizard
            </span>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Create a New Event
            </h1>
            <p className="text-sm text-slate-500">
              Fill in your event details, upload a vibrant banner, and configure initial ticket tiers. You can save as a draft or publish right away.
            </p>
          </div>
          <ol aria-label="Event setup steps" className="mt-5 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-3">
            {[
              { number: '1', label: 'Event details', target: '#event-details' },
              { number: '2', label: 'Paid ticket', target: '#ticket-setup' },
              { number: '3', label: 'Save or publish', target: '#save-event' },
            ].map((step) => <li key={step.number}><a href={step.target} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs text-indigo-700">{step.number}</span>{step.label}</a></li>)}
          </ol>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Cover Image Banner (Front and Center) */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-900">1. Event Cover Banner</h2>
              <p className="text-xs text-slate-500">
                Upload a captivating image that will appear on the event discovery catalog and ticket booking pages.
              </p>
            </div>

            <CoverImageUploader
              selectedFile={coverFile}
              onFileSelect={setCoverFile}
              fallbackTitle={title || 'Event Banner Preview'}
            />
          </div>

          {/* Section 2: Basic Event Information */}
          <div id="event-details" className="scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-900">2. Event Details</h2>
              <p className="text-xs text-slate-500">
                Provide essential information so attendees know what to anticipate.
              </p>
            </div>

            <div className="space-y-4">
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
                  placeholder="e.g. Colombo Tech & AI Summit 2026"
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
                    disabled={loadingCategories}
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
                    Overall Event Capacity (Optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    placeholder="Unlimited if left empty"
                    className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Full Event Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={5}
                  maxLength={20000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your event highlights, schedule, speakers, dress code, perks, and policies..."
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <span className="mt-1 block text-right text-[11px] text-slate-400">
                  {description.length} / 20,000 characters
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Date, Time & Venue */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-900">3. Date, Time & Venue</h2>
              <p className="text-xs text-slate-500">
                Specify when and where your guests should assemble.
              </p>
            </div>

            <div className="space-y-4">
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
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700">
                    City <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Colombo"
                    className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Venue Name / Hall <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="e.g. BMICH Hall A"
                    className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Timezone
                  </label>
                  <input
                    type="text"
                    required
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="Asia/Colombo"
                    className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Initial Ticket Setup (Optional & Convenient) */}
          <div id="ticket-setup" className="scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">4. Initial Ticket Tier</h2>
                <p className="text-xs text-slate-500">
                  Set up your first ticket tier so attendees can start registering as soon as you publish.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={includeTicket}
                  onChange={(e) => setIncludeTicket(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
              </label>
            </div>

            {includeTicket && (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Tier Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required={includeTicket}
                      value={ticketName}
                      onChange={(e) => setTicketName(e.target.value)}
                      placeholder="e.g. General Admission, VIP Pass"
                      className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Price ({ticketCurrency}) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required={includeTicket}
                      value={ticketPrice}
                      onChange={(e) => setTicketPrice(e.target.value)}
                      placeholder="e.g. 1500"
                      className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Total Quantity <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      required={includeTicket}
                      value={ticketQuantity}
                      onChange={(e) => setTicketQuantity(e.target.value)}
                      placeholder="100"
                      className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>

                <p className="mt-2 text-[11px] text-slate-500">
                  Ticket prices must be greater than zero. Add VIP, Early Bird, or workshop tiers after saving the event.
                </p>
              </div>
            )}
          </div>

          {/* Section 5: Publish Option & Actions */}
          <div id="save-event" className="scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            {includeTicket && (
              <label className="mb-6 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-indigo-50/40 p-3.5 transition hover:bg-indigo-50/70">
                <input
                  type="checkbox"
                  checked={publishImmediately}
                  onChange={(e) => setPublishImmediately(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="block text-xs font-bold text-slate-800">
                    Publish event immediately
                  </span>
                  <span className="block text-xs text-slate-500">
                    Make this event publicly discoverable and active for registrations as soon as it is created.
                  </span>
                </div>
              </label>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <Link
                to="/organizer/events"
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 active:scale-98"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all hover:from-indigo-700 hover:to-indigo-800 hover:shadow-lg hover:shadow-indigo-300 active:scale-98 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <span>Creating event…</span>
                  </>
                ) : (
                  <>
                    <IconCheck className="h-4 w-4" />
                    <span>{publishImmediately ? 'Create & Publish Event' : 'Create Draft Event'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </DashboardShell>
  )
}
