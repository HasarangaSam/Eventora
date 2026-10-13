import { AxiosError } from 'axios'
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { useToast } from '../../components/ui/toast'
import { ConfirmModal, PromptModal } from '../../components/ui/modal'
import { getEventPlaceholder } from '../../lib/placeholders'
import {
  IconPlus,
  IconCamera,
  IconTrash,
} from '../../components/ui/icons'

type Category = { id: string; name: string }
type TicketType = {
  id: string
  name: string
  price: string
  currency: string
  quantity: number
  quantityReserved: number
  quantitySold: number
  isActive: boolean
}
type Session = {
  id: string
  title: string
  startAt: string
  endAt: string
  venue: string | null
  speaker: string | null
}
type EventRecord = {
  id: string
  title: string
  description: string
  categoryId: string
  venue: string
  city: string
  startAt: string
  endAt: string
  timezone: string
  capacity: number | null
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED'
  coverImageUrl: string | null
  ticketTypes: TicketType[]
  sessions: Session[]
}
type EventForm = {
  title: string
  description: string
  categoryId: string
  venue: string
  city: string
  startAt: string
  endAt: string
  timezone: string
  capacity: string
}

const emptyForm: EventForm = {
  title: '',
  description: '',
  categoryId: '',
  venue: '',
  city: '',
  startAt: '',
  endAt: '',
  timezone: 'Asia/Colombo',
  capacity: '',
}

export function OrganizerEventsDashboard() {
  const request = useAuthenticatedApi()
  const toast = useToast()
  const [events, setEvents] = useState<EventRecord[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState<EventForm>(emptyForm)
  const [creating, setCreating] = useState(true)
  const [activeTab, setActiveTab] = useState<'details' | 'tickets' | 'schedule' | 'media'>('details')
  const [loading, setLoading] = useState(true)

  // Sub-forms state
  const [ticket, setTicket] = useState({ name: '', price: '', currency: 'LKR', quantity: '', salesStartAt: '', salesEndAt: '' })
  const [session, setSession] = useState({ title: '', startAt: '', endAt: '', venue: '', speaker: '' })

  // Modals state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)

  const selected = events.find((event) => event.id === selectedId)

  const refresh = useCallback(
    async (preserveId?: string) => {
      try {
        const [eventResponse, categoryResponse] = await Promise.all([
          request<EventRecord[]>({ method: 'GET', url: '/organizer/events' }),
          request<Category[]>({ method: 'GET', url: '/categories' }),
        ])
        setEvents(eventResponse.data)
        setCategories(categoryResponse.data)
        const nextId =
          preserveId && eventResponse.data.some((event) => event.id === preserveId)
            ? preserveId
            : eventResponse.data[0]?.id ?? ''
        setSelectedId(nextId)
        if (nextId) {
          const detail = await request<EventRecord>({ method: 'GET', url: `/organizer/events/${nextId}` })
          setEvents((current) => current.map((event) => (event.id === nextId ? detail.data : event)))
          setForm(toForm(detail.data))
          setCreating(false)
        } else {
          setForm(emptyForm)
          setCreating(true)
        }
      } catch (error) {
        toast.error(
          'Workspace Error',
          error instanceof AxiosError && error.response?.status === 403
            ? 'Organizer access requires an approved application.'
            : 'Could not load your organizer workspace.',
        )
      } finally {
        setLoading(false)
      }
    },
    [request, toast],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function submitEvent(e: FormEvent) {
    e.preventDefault()
    const payload = {
      ...form,
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      capacity: form.capacity ? Number(form.capacity) : null,
    }
    try {
      if (creating) {
        const response = await request<EventRecord>({ method: 'POST', url: '/organizer/events', data: payload })
        toast.success('Event Draft Created', 'Configure tickets and schedule, then publish when ready.')
        setCreating(false)
        setSelectedId(response.data.id)
        await refresh(response.data.id)
      } else if (selected) {
        const original = toForm(selected)
        const changedPayload: Partial<typeof payload> = {}
        if (form.title !== original.title) changedPayload.title = payload.title
        if (form.description !== original.description) changedPayload.description = payload.description
        if (form.categoryId !== original.categoryId) changedPayload.categoryId = payload.categoryId
        if (form.venue !== original.venue) changedPayload.venue = payload.venue
        if (form.city !== original.city) changedPayload.city = payload.city
        if (form.startAt !== original.startAt) changedPayload.startAt = payload.startAt
        if (form.endAt !== original.endAt) changedPayload.endAt = payload.endAt
        if (form.timezone !== original.timezone) changedPayload.timezone = payload.timezone
        if (form.capacity !== original.capacity) changedPayload.capacity = payload.capacity

        if (!Object.keys(changedPayload).length) {
          toast.success('No Changes', 'Event details are already up to date.')
          return
        }

        await request({ method: 'PATCH', url: `/organizer/events/${selected.id}`, data: changedPayload })
        toast.success('Details Saved', 'Event metadata successfully updated.')
        await refresh(selected.id)
      }
    } catch (error) {
      const apiMessage = error instanceof AxiosError ? error.response?.data?.message : undefined
      toast.error(
        'Save Failed',
        typeof apiMessage === 'string' ? apiMessage : 'Please verify all fields and date ranges.',
      )
    }
  }

  async function handlePublishToggle(action: 'publish' | 'unpublish') {
    if (!selected) return
    try {
      await request({ method: 'PATCH', url: `/organizer/events/${selected.id}/${action}` })
      toast.success(
        action === 'publish' ? 'Event Published!' : 'Returned to Draft',
        action === 'publish' ? 'Your event is now live for attendees to discover and register.' : 'The event is no longer publicly visible.',
      )
      await refresh(selected.id)
    } catch {
      toast.error('Action Failed', `Could not ${action} event. Verify that at least one ticket type is configured.`)
    }
  }

  async function handleCancelConfirm(reason: string) {
    if (!selected) return
    setActionBusy(true)
    try {
      const response = await request<{ cancellationNoticesQueued: number }>({
        method: 'PATCH',
        url: `/organizer/events/${selected.id}/cancel`,
        data: { reason },
      })
      toast.success('Event Cancelled', `${response.data.cancellationNoticesQueued} attendee notice(s) queued for delivery.`)
      setCancelModalOpen(false)
      await refresh(selected.id)
    } catch {
      toast.error('Cancellation Error', 'Could not cancel event.')
    } finally {
      setActionBusy(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!selected) return
    setActionBusy(true)
    try {
      await request({ method: 'DELETE', url: `/organizer/events/${selected.id}` })
      toast.success('Event Deleted', 'The draft event has been removed.')
      setDeleteModalOpen(false)
      setSelectedId('')
      setCreating(true)
      await refresh()
    } catch {
      toast.error('Cannot Delete', 'Events with purchase or registration history cannot be deleted.')
    } finally {
      setActionBusy(false)
    }
  }

  async function addTicket(e: FormEvent) {
    e.preventDefault()
    if (!selected) return
    try {
      await request({
        method: 'POST',
        url: `/organizer/events/${selected.id}/ticket-types`,
        data: {
          ...ticket,
          quantity: Number(ticket.quantity),
          salesStartAt: ticket.salesStartAt ? new Date(ticket.salesStartAt).toISOString() : null,
          salesEndAt: ticket.salesEndAt ? new Date(ticket.salesEndAt).toISOString() : null,
        },
      })
      setTicket({ name: '', price: '', currency: 'LKR', quantity: '', salesStartAt: '', salesEndAt: '' })
      toast.success('Ticket Tier Added', `Created ${ticket.name} tier.`)
      await refresh(selected.id)
    } catch {
      toast.error('Ticket Error', 'Price must be greater than zero and quantity valid.')
    }
  }

  async function toggleTicketType(item: TicketType) {
    if (!selected) return
    try {
      await request({
        method: 'PATCH',
        url: `/organizer/events/${selected.id}/ticket-types/${item.id}/activation`,
        data: { isActive: !item.isActive },
      })
      toast.success('Ticket Status Changed', `${item.name} is now ${!item.isActive ? 'active' : 'paused'}.`)
      await refresh(selected.id)
    } catch {
      toast.error('Update Failed', 'Ticket status could not be changed.')
    }
  }

  async function deleteTicketType(id: string) {
    if (!selected) return
    try {
      await request({ method: 'DELETE', url: `/organizer/events/${selected.id}/ticket-types/${id}` })
      toast.success('Ticket Tier Removed', 'Tier deleted successfully.')
      await refresh(selected.id)
    } catch {
      toast.error('Delete Failed', 'Cannot delete ticket types that already have sales history.')
    }
  }

  async function addSession(e: FormEvent) {
    e.preventDefault()
    if (!selected) return
    try {
      await request({
        method: 'POST',
        url: `/organizer/events/${selected.id}/sessions`,
        data: {
          ...session,
          startAt: new Date(session.startAt).toISOString(),
          endAt: new Date(session.endAt).toISOString(),
          venue: session.venue || null,
          speaker: session.speaker || null,
        },
      })
      setSession({ title: '', startAt: '', endAt: '', venue: '', speaker: '' })
      toast.success('Session Added', 'Schedule agenda item recorded.')
      await refresh(selected.id)
    } catch {
      toast.error('Schedule Error', 'Session times must fall within the event duration.')
    }
  }

  async function deleteSession(id: string) {
    if (!selected) return
    try {
      await request({ method: 'DELETE', url: `/organizer/events/${selected.id}/sessions/${id}` })
      toast.success('Session Removed', 'Schedule entry deleted.')
      await refresh(selected.id)
    } catch {
      toast.error('Delete Failed', 'Could not delete session.')
    }
  }

  async function uploadCover(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selected) return
    const file = new FormData(e.currentTarget).get('file')
    if (!(file instanceof File) || !file.size) return
    const data = new FormData()
    data.append('file', file)
    try {
      await request({
        method: 'POST',
        url: `/organizer/events/${selected.id}/cover-image`,
        data,
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Cover Image Uploaded', 'Event banner image has been updated.')
      await refresh(selected.id)
    } catch {
      toast.error('Upload Failed', 'Use a JPEG, PNG, or WebP image under 5 MB.')
    }
  }

  async function deleteCover() {
    if (!selected) return
    try {
      await request({ method: 'DELETE', url: `/organizer/events/${selected.id}/cover-image` })
      toast.success('Cover Removed', 'Event cover image reset to placeholder.')
      await refresh(selected.id)
    } catch {
      toast.error('Removal Failed', 'Cover image could not be removed.')
    }
  }

  function chooseEvent(id: string) {
    setSelectedId(id)
    setCreating(false)
    const event = events.find((record) => record.id === id)
    if (event) setForm(toForm(event))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Studio Header & Action Strip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 800 }}>Events Studio</h2>
          <p className="text-muted" style={{ margin: 0, fontSize: '14px' }}>
            Design experiences, manage ticket inventory, and oversee attendee admissions.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px]"
          onClick={() => {
            setCreating(true)
            setSelectedId('')
            setForm({ ...emptyForm, categoryId: categories[0]?.id ?? '' })
            setActiveTab('details')
          }}
        >
          <IconPlus /> Create New Event
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center' }}>
          <div className="h-8 w-8 rounded-full border-[3px] border-[rgba(99,102,241,0.2)] border-t-[var(--primary)] animate-[spin_0.8s_linear_infinite]" style={{ margin: '0 auto 12px' }} />
          <p className="text-muted">Loading your events…</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '28px', alignItems: 'start' }}>
          {/* Left Event Navigator */}
          <div className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ margin: 0, padding: '16px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Your Events ({events.length})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {events.map((ev) => (
                <button
                  type="button"
                  key={ev.id}
                  onClick={() => chooseEvent(ev.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '6px',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid',
                    borderColor: ev.id === selectedId && !creating ? 'var(--primary)' : 'var(--border)',
                    background: ev.id === selectedId && !creating ? '#eef2ff' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{ev.title}</strong>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <span className="text-muted" style={{ fontSize: '12px' }}>
                      {new Date(ev.startAt).toLocaleDateString()}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none capitalize badge-sm ${ev.status === 'PUBLISHED' ? "border border-[#a7f3d0] bg-[#ecfdf5] text-[#059669] [--badge-dot-color:#10b981]" : ev.status === 'CANCELLED' ? "border border-[#fecaca] bg-[#fef2f2] text-[#dc2626] [--badge-dot-color:#ef4444]" : "border border-slate-200 bg-slate-100 text-slate-600 [--badge-dot-color:#64748b]"}`}
                    >
                      {ev.status.toLowerCase()}
                    </span>
                  </div>
                </button>
              ))}
              {!events.length && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No events created yet. Click "Create New Event" above to get started.
                </div>
              )}
            </div>
          </div>

          {/* Right Editor Workspace */}
          <div className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ margin: 0 }}>
            {/* Status & Action Bar */}
            {!creating && selected && (
              <div
                style={{
                  padding: '16px 24px',
                  background: '#f8fafc',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none capitalize ${selected.status === 'PUBLISHED' ? "border border-[#a7f3d0] bg-[#ecfdf5] text-[#059669] [--badge-dot-color:#10b981]" : "border border-[#fde68a] bg-[#fffbeb] text-[#d97706] [--badge-dot-color:#f59e0b]"}`}>
                    <span className="h-[6px] w-[6px] rounded-full bg-[var(--badge-dot-color)]" />
                    {selected.status.toLowerCase()}
                  </span>
                  <span className="text-muted" style={{ fontSize: '13px' }}>
                    {selected.ticketTypes.length} ticket tiers · {selected.sessions.length} sessions
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <Link to={`/organizer/events/${selected.id}/check-in`} className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)] [--button-px:12px] [--button-py:6px] [--button-font-size:13px] [--button-radius:var(--radius-sm)] text-[13px]">
                    <IconCamera /> Open Check-in Console
                  </Link>

                  {selected.status === 'DRAFT' && (
                    <button type="button" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px] [--button-px:12px] [--button-py:6px] [--button-font-size:13px] [--button-radius:var(--radius-sm)] text-[13px]" onClick={() => void handlePublishToggle('publish')}>
                      Publish Event
                    </button>
                  )}
                  {selected.status === 'PUBLISHED' && (
                    <button type="button" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)] [--button-px:12px] [--button-py:6px] [--button-font-size:13px] [--button-radius:var(--radius-sm)] text-[13px]" onClick={() => void handlePublishToggle('unpublish')}>
                      Unpublish (Draft)
                    </button>
                  )}
                  {selected.status !== 'CANCELLED' && selected.status !== 'COMPLETED' && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border-0 bg-transparent px-2 py-1 text-[13px] font-semibold text-[var(--text-button-color,var(--primary))] cursor-pointer transition-[all] duration-150 hover:bg-[var(--text-button-bg,var(--primary-light))] hover:text-[var(--text-button-hover,var(--primary-hover))] [--text-button-color:var(--danger)] [--text-button-hover:#b91c1c] [--text-button-bg:var(--danger-bg)]"
                      onClick={() => setCancelModalOpen(true)}
                    >
                      Cancel Event
                    </button>
                  )}
                  {selected.status !== 'CANCELLED' && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border-0 bg-transparent px-2 py-1 text-[13px] font-semibold text-[var(--text-button-color,var(--primary))] cursor-pointer transition-[all] duration-150 hover:bg-[var(--text-button-bg,var(--primary-light))] hover:text-[var(--text-button-hover,var(--primary-hover))] [--text-button-color:var(--danger)] [--text-button-hover:#b91c1c] [--text-button-bg:var(--danger-bg)]"
                      onClick={() => setDeleteModalOpen(true)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Studio Navigation Tabs */}
            {!creating && selected && (
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
                <button
                  type="button"
                  className="cursor-pointer border-0 bg-transparent px-[18px] py-[14px] text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)]"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '14px 18px' }}
                  onClick={() => setActiveTab('details')}
                >
                  General Details
                </button>
                <button
                  type="button"
                  className="cursor-pointer border-0 bg-transparent px-[18px] py-[14px] text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)]"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '14px 18px' }}
                  onClick={() => setActiveTab('tickets')}
                >
                  Tickets & Pricing ({selected.ticketTypes.length})
                </button>
                <button
                  type="button"
                  className="cursor-pointer border-0 bg-transparent px-[18px] py-[14px] text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)]"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '14px 18px' }}
                  onClick={() => setActiveTab('schedule')}
                >
                  Schedule / Agenda ({selected.sessions.length})
                </button>
                <button
                  type="button"
                  className="cursor-pointer border-0 bg-transparent px-[18px] py-[14px] text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)]"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '14px 18px' }}
                  onClick={() => setActiveTab('media')}
                >
                  Cover Image & Media
                </button>
              </div>
            )}

            <div style={{ padding: '28px' }}>
              {/* Tab 1: Event Details Form */}
              {(creating || activeTab === 'details') && (
                <form onSubmit={submitEvent}>
                  <h3 style={{ margin: '0 0 20px', fontSize: '18px' }}>{creating ? 'Create Event Draft' : 'Event Details & Logistics'}</h3>
                  <div className="mb-[18px] flex flex-col gap-1.5">
                    <label className="text-[13px] font-semibold text-[var(--text-main)]">Event Title</label>
                    <input
                      required
                      maxLength={200}
                      className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. Colombo Tech Summit 2026"
                    />
                  </div>

                  <div className="mb-[18px] flex flex-col gap-1.5">
                    <label className="text-[13px] font-semibold text-[var(--text-main)]">Full Description</label>
                    <textarea
                      required
                      rows={5}
                      maxLength={20000}
                      className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Describe what attendees can expect, speakers, dress code, benefits…"
                    />
                  </div>

                  <div className="mb-[18px] grid grid-cols-3 gap-[18px]">
                    <div className="mb-[18px] flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[var(--text-main)]">Category</label>
                      <select
                        required
                        className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                        value={form.categoryId}
                        onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                      >
                        <option value="">Select Category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-[18px] flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[var(--text-main)]">City</label>
                      <input
                        required
                        className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        placeholder="e.g. Colombo"
                      />
                    </div>

                    <div className="mb-[18px] flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[var(--text-main)]">Venue / Hall</label>
                      <input
                        required
                        className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                        value={form.venue}
                        onChange={(e) => setForm({ ...form, venue: e.target.value })}
                        placeholder="e.g. BMICH Hall A"
                      />
                    </div>
                  </div>

                  <div className="mb-[18px] grid grid-cols-3 gap-[18px]">
                    <div className="mb-[18px] flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[var(--text-main)]">Starts At</label>
                      <input
                        required
                        type="datetime-local"
                        className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                        value={form.startAt}
                        onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                      />
                    </div>

                    <div className="mb-[18px] flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[var(--text-main)]">Ends At</label>
                      <input
                        required
                        type="datetime-local"
                        className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                        value={form.endAt}
                        onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                      />
                    </div>

                    <div className="mb-[18px] flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[var(--text-main)]">Capacity (Optional)</label>
                      <input
                        type="number"
                        min="1"
                        className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                        value={form.capacity}
                        onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                        placeholder="Unlimited"
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px]">
                      {creating ? 'Create Draft & Continue' : 'Save Event Details'}
                    </button>
                  </div>
                </form>
              )}

              {/* Tab 2: Tickets & Pricing */}
              {!creating && selected && activeTab === 'tickets' && (
                <div>
                  <h3 style={{ margin: '0 0 16px', fontSize: '18px' }}>Ticket Tiers & Inventory</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                    {selected.ticketTypes.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          background: '#ffffff',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-lg)',
                          padding: '18px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          boxShadow: 'var(--shadow-sm)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '16px' }}>{t.name}</strong>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none capitalize ${t.isActive ? "border border-[#a7f3d0] bg-[#ecfdf5] text-[#059669] [--badge-dot-color:#10b981]" : "border border-slate-200 bg-slate-100 text-slate-600 [--badge-dot-color:#64748b]"}`}>
                            {t.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)' }}>
                          {t.currency} {Number(t.price).toLocaleString()}
                        </div>
                        <div className="text-muted" style={{ fontSize: '13px' }}>
                          Committed: {t.quantitySold + t.quantityReserved} / {t.quantity} tickets
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                          <button type="button" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)] [--button-px:12px] [--button-py:6px] [--button-font-size:13px] [--button-radius:var(--radius-sm)] text-[13px]" onClick={() => void toggleTicketType(t)}>
                            {t.isActive ? 'Pause' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)] [--button-px:12px] [--button-py:6px] [--button-font-size:13px] [--button-radius:var(--radius-sm)] text-[13px]"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => void deleteTicketType(t.id)}
                          >
                            <IconTrash style={{ width: '14px', height: '14px' }} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: '#f8fafc', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                    <h4 style={{ margin: '0 0 16px', fontSize: '15px' }}>Add Paid Ticket Tier</h4>
                    <form onSubmit={addTicket}>
                      <div className="mb-[18px] grid grid-cols-3 gap-[18px]">
                        <div className="mb-[18px] flex flex-col gap-1.5">
                          <label className="text-[13px] font-semibold text-[var(--text-main)]">Tier Name</label>
                          <input
                            required
                            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                            value={ticket.name}
                            onChange={(e) => setTicket({ ...ticket, name: e.target.value })}
                            placeholder="e.g. VIP Pass, Early Bird"
                          />
                        </div>
                        <div className="mb-[18px] flex flex-col gap-1.5">
                          <label className="text-[13px] font-semibold text-[var(--text-main)]">Price</label>
                          <input
                            required
                            inputMode="decimal"
                            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                            value={ticket.price}
                            onChange={(e) => setTicket({ ...ticket, price: e.target.value })}
                            placeholder="e.g. 5000"
                          />
                        </div>
                        <div className="mb-[18px] flex flex-col gap-1.5">
                          <label className="text-[13px] font-semibold text-[var(--text-main)]">Total Quantity</label>
                          <input
                            required
                            type="number"
                            min="1"
                            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                            value={ticket.quantity}
                            onChange={(e) => setTicket({ ...ticket, quantity: e.target.value })}
                            placeholder="e.g. 100"
                          />
                        </div>
                      </div>
                      <button type="submit" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px] [--button-px:12px] [--button-py:6px] [--button-font-size:13px] [--button-radius:var(--radius-sm)] text-[13px]">
                        <IconPlus /> Add Ticket Tier
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Tab 3: Schedule / Agenda */}
              {!creating && selected && activeTab === 'schedule' && (
                <div>
                  <h3 style={{ margin: '0 0 16px', fontSize: '18px' }}>Event Schedule & Sessions</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
                    {selected.sessions.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '16px 20px',
                          background: '#f8fafc',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '15px', display: 'block' }}>{s.title}</strong>
                          <span className="text-muted" style={{ fontSize: '13px' }}>
                            {new Date(s.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                            {new Date(s.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {s.speaker && ` · Speaker: ${s.speaker}`}
                            {s.venue && ` · Room: ${s.venue}`}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)] [--button-px:12px] [--button-py:6px] [--button-font-size:13px] [--button-radius:var(--radius-sm)] text-[13px]"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => void deleteSession(s.id)}
                        >
                          <IconTrash style={{ width: '14px', height: '14px' }} />
                        </button>
                      </div>
                    ))}
                    {!selected.sessions.length && (
                      <p className="text-muted">No schedule items added yet.</p>
                    )}
                  </div>

                  <div style={{ background: '#f8fafc', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                    <h4 style={{ margin: '0 0 16px', fontSize: '15px' }}>Add Schedule Entry</h4>
                    <form onSubmit={addSession}>
                      <div className="mb-[18px] grid grid-cols-2 gap-[18px]">
                        <div className="mb-[18px] flex flex-col gap-1.5">
                          <label className="text-[13px] font-semibold text-[var(--text-main)]">Session Title</label>
                          <input
                            required
                            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                            value={session.title}
                            onChange={(e) => setSession({ ...session, title: e.target.value })}
                            placeholder="e.g. Keynote Address"
                          />
                        </div>
                        <div className="mb-[18px] flex flex-col gap-1.5">
                          <label className="text-[13px] font-semibold text-[var(--text-main)]">Speaker / Host (Optional)</label>
                          <input
                            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                            value={session.speaker}
                            onChange={(e) => setSession({ ...session, speaker: e.target.value })}
                            placeholder="e.g. Dr. Jane Doe"
                          />
                        </div>
                      </div>
                      <div className="mb-[18px] grid grid-cols-3 gap-[18px]">
                        <div className="mb-[18px] flex flex-col gap-1.5">
                          <label className="text-[13px] font-semibold text-[var(--text-main)]">Starts At</label>
                          <input
                            required
                            type="datetime-local"
                            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                            value={session.startAt}
                            onChange={(e) => setSession({ ...session, startAt: e.target.value })}
                          />
                        </div>
                        <div className="mb-[18px] flex flex-col gap-1.5">
                          <label className="text-[13px] font-semibold text-[var(--text-main)]">Ends At</label>
                          <input
                            required
                            type="datetime-local"
                            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                            value={session.endAt}
                            onChange={(e) => setSession({ ...session, endAt: e.target.value })}
                          />
                        </div>
                        <div className="mb-[18px] flex flex-col gap-1.5">
                          <label className="text-[13px] font-semibold text-[var(--text-main)]">Stage / Room</label>
                          <input
                            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                            value={session.venue}
                            onChange={(e) => setSession({ ...session, venue: e.target.value })}
                            placeholder="e.g. Main Auditorium"
                          />
                        </div>
                      </div>
                      <button type="submit" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px] [--button-px:12px] [--button-py:6px] [--button-font-size:13px] [--button-radius:var(--radius-sm)] text-[13px]">
                        <IconPlus /> Add Schedule Entry
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Tab 4: Cover Image & Media */}
              {!creating && selected && activeTab === 'media' && (
                <div>
                  <h3 style={{ margin: '0 0 16px', fontSize: '18px' }}>Event Cover Image</h3>
                  <div style={{ maxWidth: '640px', marginBottom: '24px' }}>
                    <div
                      style={{
                        position: 'relative',
                        aspectRatio: '16 / 9',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden',
                        boxShadow: 'var(--shadow-md)',
                        marginBottom: '16px',
                        background: '#0f172a',
                      }}
                    >
                      <img
                        src={selected.coverImageUrl || getEventPlaceholder(selected.title)}
                        alt="Event cover preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>

                    <form onSubmit={uploadCover} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <label className="text-[13px] font-semibold text-[var(--text-main)]">Upload Custom Cover Image (JPEG, PNG, WebP up to 5 MB)</label>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]" />
                        <button type="submit" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px] [--button-px:12px] [--button-py:6px] [--button-font-size:13px] [--button-radius:var(--radius-sm)] text-[13px]">Upload</button>
                        {selected.coverImageUrl && (
                          <button type="button" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)] [--button-px:12px] [--button-py:6px] [--button-font-size:13px] [--button-radius:var(--radius-sm)] text-[13px]" onClick={() => void deleteCover()}>
                            Reset to Default
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Reason Modal */}
      <PromptModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleCancelConfirm}
        title="Cancel This Event?"
        message="Canceling this event stops further ticket sales and notifies all registered attendees."
        label="Reason for attendees"
        placeholder="Please explain the reason for cancellation"
        minLength={5}
        loading={actionBusy}
      />

      {/* Delete Event Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Draft Event?"
        message="Are you sure you want to permanently delete this event? This action can only be completed if no registrations or ticket history exist."
        destructive
        confirmText="Delete Event"
        loading={actionBusy}
      />
    </div>
  )
}

function toForm(event: EventRecord): EventForm {
  const localDate = (value: string) => {
    const date = new Date(value)
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
    return date.toISOString().slice(0, 16)
  }
  return {
    title: event.title,
    description: event.description,
    categoryId: event.categoryId,
    venue: event.venue,
    city: event.city,
    startAt: localDate(event.startAt),
    endAt: localDate(event.endAt),
    timezone: event.timezone,
    capacity: event.capacity?.toString() ?? '',
  }
}
