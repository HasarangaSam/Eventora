import { AxiosError } from 'axios'
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'

type Category = { id: string; name: string }
type TicketType = { id: string; name: string; price: string; currency: string; quantity: number; quantityReserved: number; quantitySold: number; isActive: boolean }
type Session = { id: string; title: string; startAt: string; endAt: string; venue: string | null; speaker: string | null }
type EventRecord = {
  id: string; title: string; description: string; categoryId: string; venue: string; city: string; startAt: string; endAt: string
  timezone: string; capacity: number | null; status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED'
  coverImageUrl: string | null; ticketTypes: TicketType[]; sessions: Session[]
}
type EventForm = { title: string; description: string; categoryId: string; venue: string; city: string; startAt: string; endAt: string; timezone: string; capacity: string }
const emptyForm: EventForm = { title: '', description: '', categoryId: '', venue: '', city: '', startAt: '', endAt: '', timezone: 'Asia/Colombo', capacity: '' }

export function OrganizerEventsDashboard() {
  const request = useAuthenticatedApi()
  const [events, setEvents] = useState<EventRecord[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState<EventForm>(emptyForm)
  const [creating, setCreating] = useState(true)
  const [ticket, setTicket] = useState({ name: '', price: '', currency: 'LKR', quantity: '', salesStartAt: '', salesEndAt: '' })
  const [session, setSession] = useState({ title: '', startAt: '', endAt: '', venue: '', speaker: '' })
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const selected = events.find((event) => event.id === selectedId)

  const refresh = useCallback(async (preserveId?: string) => {
    try {
      const [eventResponse, categoryResponse] = await Promise.all([
        request<EventRecord[]>({ method: 'GET', url: '/organizer/events' }),
        request<Category[]>({ method: 'GET', url: '/categories' }),
      ])
      setEvents(eventResponse.data)
      setCategories(categoryResponse.data)
      const nextId = preserveId && eventResponse.data.some((event) => event.id === preserveId) ? preserveId : eventResponse.data[0]?.id ?? ''
      setSelectedId(nextId)
      if (nextId) {
        const detail = await request<EventRecord>({ method: 'GET', url: `/organizer/events/${nextId}` })
        setEvents((current) => current.map((event) => event.id === nextId ? detail.data : event))
        setForm(toForm(detail.data))
        setCreating(false)
      } else {
        setForm(emptyForm)
        setCreating(true)
      }
      setMessage('')
    } catch (error) {
      setMessage(error instanceof AxiosError && error.response?.status === 403
        ? 'Organizer access requires an approved organizer application.'
        : 'Organizer workspace could not load. Check your connection and retry.')
    } finally { setLoading(false) }
  }, [request])

  useEffect(() => { void Promise.resolve().then(() => refresh()) }, [refresh])

  async function submitEvent(event: FormEvent) {
    event.preventDefault()
    const payload = {
      ...form,
      startAt: new Date(form.startAt).toISOString(), endAt: new Date(form.endAt).toISOString(),
      capacity: form.capacity ? Number(form.capacity) : null,
    }
    try {
      if (creating) {
        const response = await request<EventRecord>({ method: 'POST', url: '/organizer/events', data: payload })
        setCreating(false); setSelectedId(response.data.id); await refresh(response.data.id)
      } else if (selected) {
        await request({ method: 'PATCH', url: `/organizer/events/${selected.id}`, data: payload })
        await refresh(selected.id)
      }
      setMessage(creating ? 'Draft event created.' : 'Event details saved.')
    } catch { setMessage('Event could not be saved. Review the fields and try again.') }
  }

  async function statusAction(action: 'publish' | 'unpublish' | 'cancel' | 'delete') {
    if (!selected) return
    if (action === 'cancel' && !window.confirm('Cancel this event? Confirmed attendees will be queued for notification.')) return
    if (action === 'delete' && !window.confirm('Delete this event? This is available only while it has no registrations or ticket history.')) return
    let cancellationNoticesQueued = 0
    try {
      if (action === 'cancel') {
        const response = await request<{ cancellationNoticesQueued: number }>({ method: 'PATCH', url: `/organizer/events/${selected.id}/cancel`, data: { reason: 'Cancelled by organizer' } })
        cancellationNoticesQueued = response.data.cancellationNoticesQueued
      }
      else if (action === 'delete') await request({ method: 'DELETE', url: `/organizer/events/${selected.id}` })
      else await request({ method: 'PATCH', url: `/organizer/events/${selected.id}/${action}` })
      if (action === 'delete') { setSelectedId(''); setCreating(true); await refresh() } else await refresh(selected.id)
      const success = action === 'publish' ? 'Event published.' : action === 'unpublish' ? 'Event returned to draft.' : action === 'cancel' ? `Event cancelled. ${cancellationNoticesQueued} attendee notice(s) queued for delivery.` : 'Event deleted.'
      setMessage(success)
    } catch { setMessage(`Event could not be ${action}d. Check its status and existing registrations.`) }
  }

  async function addTicket(event: FormEvent) {
    event.preventDefault(); if (!selected) return
    try {
      await request({ method: 'POST', url: `/organizer/events/${selected.id}/ticket-types`, data: {
        ...ticket, quantity: Number(ticket.quantity), salesStartAt: ticket.salesStartAt ? new Date(ticket.salesStartAt).toISOString() : null,
        salesEndAt: ticket.salesEndAt ? new Date(ticket.salesEndAt).toISOString() : null,
      } })
      setTicket({ name: '', price: '', currency: 'LKR', quantity: '', salesStartAt: '', salesEndAt: '' }); await refresh(selected.id); setMessage('Paid ticket type added.')
    } catch { setMessage('Ticket type could not be added. Price must be greater than zero and inventory must be valid.') }
  }

  async function addSession(event: FormEvent) {
    event.preventDefault(); if (!selected) return
    try {
      await request({ method: 'POST', url: `/organizer/events/${selected.id}/sessions`, data: {
        ...session, startAt: new Date(session.startAt).toISOString(), endAt: new Date(session.endAt).toISOString(),
        venue: session.venue || null, speaker: session.speaker || null,
      } })
      setSession({ title: '', startAt: '', endAt: '', venue: '', speaker: '' }); await refresh(selected.id); setMessage('Schedule entry added.')
    } catch { setMessage('Schedule entry could not be added. Its times must be within the event schedule.') }
  }

  async function uploadCover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return
    const file = new FormData(event.currentTarget).get('file')
    if (!(file instanceof File) || !file.size) return
    const data = new FormData(); data.append('file', file)
    try { await request({ method: 'POST', url: `/organizer/events/${selected.id}/cover-image`, data, headers: { 'Content-Type': 'multipart/form-data' } }); await refresh(selected.id); setMessage('Cover image updated.') }
    catch { setMessage('Cover image could not be uploaded. Use a JPEG, PNG, or WebP image up to 5 MB.') }
  }

  async function toggleTicketType(item: TicketType) {
    if (!selected) return
    try {
      await request({ method: 'PATCH', url: `/organizer/events/${selected.id}/ticket-types/${item.id}/activation`, data: { isActive: !item.isActive } })
      await refresh(selected.id)
    } catch { setMessage('Ticket type status could not be changed.') }
  }

  async function removeRecord(kind: 'ticket-types' | 'sessions', id: string) {
    if (!selected || !window.confirm(`Delete this ${kind === 'sessions' ? 'schedule entry' : 'ticket type'} if it has no history?`)) return
    try {
      await request({ method: 'DELETE', url: `/organizer/events/${selected.id}/${kind}/${id}` })
      await refresh(selected.id)
      setMessage(`${kind === 'sessions' ? 'Schedule entry' : 'Ticket type'} deleted.`)
    } catch { setMessage('This record could not be deleted because it may have reservation or sales history.') }
  }

  async function deleteCover() {
    if (!selected || !window.confirm('Remove this event cover image?')) return
    try {
      await request({ method: 'DELETE', url: `/organizer/events/${selected.id}/cover-image` })
      await refresh(selected.id); setMessage('Cover image removed.')
    } catch { setMessage('Cover image could not be removed. Try again.') }
  }

  function chooseEvent(id: string) {
    setSelectedId(id); setCreating(false)
    const event = events.find((record) => record.id === id)
    if (event) setForm(toForm(event))
  }

  return <section className="organizer-dashboard" aria-labelledby="organizer-events-title">
    <div className="section-heading"><div><span className="eyebrow">Organizer workspace</span><h2 id="organizer-events-title">Your events</h2></div><button className="button button--small" type="button" onClick={() => { setCreating(true); setSelectedId(''); setForm({ ...emptyForm, categoryId: categories[0]?.id ?? '' }) }}>Create event</button></div>
    {message && <p className="dashboard-message" role="status">{message}</p>}
    {loading ? <p>Loading your events…</p> : <div className="organizer-layout">
      <div className="organizer-event-list" aria-label="Your event list">
        {events.map((event) => <button type="button" key={event.id} className={`organizer-event-choice${event.id === selectedId && !creating ? ' is-selected' : ''}`} onClick={() => chooseEvent(event.id)}><strong>{event.title}</strong><span className={`application-status application-status--${event.status.toLowerCase()}`}>{event.status.toLowerCase()}</span></button>)}
        {!events.length && <p className="inline-notice">You haven’t created an event yet.</p>}
      </div>
      <div className="organizer-editor">
        <form className="organizer-form" onSubmit={submitEvent}>
          <h3>{creating ? 'Start a draft' : 'Event details'}</h3>
          <label>Event title<input required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label>Description<textarea required maxLength={20000} rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <div className="organizer-form-grid"><label>Category<select required value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">Choose category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Venue<input required value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></label><label>City<input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label><label>Timezone<input required value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} /></label><label>Starts<input required type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} /></label><label>Ends<input required type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} /></label><label>Capacity <span>(optional)</span><input min="1" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></label></div>
          <button className="button button--dark" type="submit">{creating ? 'Save draft' : 'Save event details'}</button>
        </form>
        {!creating && selected && <>
          <div className="organizer-actions"><strong>Event status: {selected.status.toLowerCase()}</strong>{selected.status === 'DRAFT' && <button className="button button--small" type="button" onClick={() => void statusAction('publish')}>Publish</button>}{selected.status === 'PUBLISHED' && <button className="text-button" type="button" onClick={() => void statusAction('unpublish')}>Unpublish</button>}{!['CANCELLED', 'COMPLETED'].includes(selected.status) && <button className="text-button" type="button" onClick={() => void statusAction('cancel')}>Cancel event</button>}{selected.status !== 'CANCELLED' && <button className="text-button" type="button" onClick={() => void statusAction('delete')}>Delete if no history</button>}</div>
          <form className="organizer-form" onSubmit={uploadCover}><h3>Cover image</h3>{selected.coverImageUrl && <img className="organizer-cover-preview" src={selected.coverImageUrl} alt="Current event cover" />}<label>JPEG, PNG, or WebP · up to 5 MB<input required type="file" name="file" accept="image/jpeg,image/png,image/webp" /></label><div><button className="text-button" type="submit">Upload cover</button>{selected.coverImageUrl && <button className="text-button" type="button" onClick={() => void deleteCover()}>Remove cover</button>}</div></form>
          <form className="organizer-form" onSubmit={addTicket}><h3>Paid ticket type</h3><div className="organizer-form-grid"><label>Name<input required value={ticket.name} onChange={(e) => setTicket({ ...ticket, name: e.target.value })} /></label><label>Price<input required inputMode="decimal" value={ticket.price} onChange={(e) => setTicket({ ...ticket, price: e.target.value })} /></label><label>Currency<input required maxLength={3} value={ticket.currency} onChange={(e) => setTicket({ ...ticket, currency: e.target.value.toUpperCase() })} /></label><label>Quantity<input required min="1" type="number" value={ticket.quantity} onChange={(e) => setTicket({ ...ticket, quantity: e.target.value })} /></label><label>Sales start<input type="datetime-local" value={ticket.salesStartAt} onChange={(e) => setTicket({ ...ticket, salesStartAt: e.target.value })} /></label><label>Sales end<input type="datetime-local" value={ticket.salesEndAt} onChange={(e) => setTicket({ ...ticket, salesEndAt: e.target.value })} /></label></div><button className="text-button" type="submit">Add ticket type</button>
            {selected.ticketTypes.map((item) => <div className="organizer-inventory-row" key={item.id}><span>{item.name} · {item.currency} {item.price} · {item.quantitySold + item.quantityReserved}/{item.quantity} committed</span><div><button className="text-button" type="button" onClick={() => void toggleTicketType(item)}>{item.isActive ? 'Deactivate' : 'Activate'}</button><button className="text-button" type="button" onClick={() => void removeRecord('ticket-types', item.id)}>Delete</button></div></div>)}
          </form>
          <form className="organizer-form" onSubmit={addSession}><h3>Schedule entry</h3><div className="organizer-form-grid"><label>Title<input required value={session.title} onChange={(e) => setSession({ ...session, title: e.target.value })} /></label><label>Speaker<input value={session.speaker} onChange={(e) => setSession({ ...session, speaker: e.target.value })} /></label><label>Starts<input required type="datetime-local" value={session.startAt} onChange={(e) => setSession({ ...session, startAt: e.target.value })} /></label><label>Ends<input required type="datetime-local" value={session.endAt} onChange={(e) => setSession({ ...session, endAt: e.target.value })} /></label><label>Room or venue<input value={session.venue} onChange={(e) => setSession({ ...session, venue: e.target.value })} /></label></div><button className="text-button" type="submit">Add schedule entry</button>{selected.sessions.map((item) => <div className="organizer-inventory-row" key={item.id}><span>{item.title} · {new Date(item.startAt).toLocaleString()}</span><button className="text-button" type="button" onClick={() => void removeRecord('sessions', item.id)}>Delete</button></div>)}</form>
        </>}
      </div>
    </div>}
  </section>
}

function toForm(event: EventRecord): EventForm {
  const localDate = (value: string) => { const date = new Date(value); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16) }
  return { title: event.title, description: event.description, categoryId: event.categoryId, venue: event.venue, city: event.city, startAt: localDate(event.startAt), endAt: localDate(event.endAt), timezone: event.timezone, capacity: event.capacity?.toString() ?? '' }
}
