import { useEffect, useRef, useState, type FormEvent } from 'react'
import { SignInButton, useAuth } from '@clerk/react'
import { Link, useParams } from 'react-router'
import { api } from '../../lib/api'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import heroImage from '../../assets/hero.png'
import { formatEventDate } from './event-format'

interface EventDetails {
  id: string
  slug: string
  title: string
  description: string
  venue: string
  city: string
  startAt: string
  endAt: string
  timezone: string
  coverImageUrl: string | null
  category: { name: string; slug: string }
}
interface Session { id: string; title: string; description: string | null; speaker: string | null; venue: string | null; startAt: string; endAt: string }
interface TicketType {
  id: string
  name: string
  description: string | null
  price: string
  currency: string
  salesStartAt: string | null
  salesEndAt: string | null
  availableQuantity: number
  isOnSale: boolean
}
interface CheckoutContact {
  firstName: string
  lastName: string
  phone: string
  address: string
  city: string
  country: string
}
interface RegistrationResponse { id: string }
interface CheckoutResponse { checkoutUrl: string; method: 'POST'; fields: Record<string, string> }

type PageState =
  | { identifier: string; status: 'loading' }
  | { identifier: string; status: 'ready'; event: EventDetails; sessions: Session[]; tickets: TicketType[] }
  | { identifier: string; status: 'not-found' }
  | { identifier: string; status: 'error' }

export function EventDetailPage() {
  const { eventId = '' } = useParams()
  const { isLoaded, isSignedIn } = useAuth()
  const authenticatedRequest = useAuthenticatedApi()
  const [state, setState] = useState<PageState>({ identifier: '', status: 'loading' })
  const [selectedTicketId, setSelectedTicketId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [contact, setContact] = useState<CheckoutContact>({ firstName: '', lastName: '', phone: '', address: '', city: '', country: 'Sri Lanka' })
  const [checkoutMessage, setCheckoutMessage] = useState('')
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [registrationStarted, setRegistrationStarted] = useState(false)
  const [expiredReservation, setExpiredReservation] = useState(false)
  const registrationKey = useRef<string | null>(null)
  const registrationId = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    void Promise.all([
      api.get<EventDetails>(`/events/${encodeURIComponent(eventId)}`),
      api.get<Session[]>(`/events/${encodeURIComponent(eventId)}/sessions`),
      api.get<TicketType[]>(`/events/${encodeURIComponent(eventId)}/ticket-types`),
    ]).then(([eventResponse, sessionResponse, ticketResponse]) => {
      if (active) setState({ identifier: eventId, status: 'ready', event: eventResponse.data, sessions: sessionResponse.data, tickets: ticketResponse.data })
    }).catch((error: unknown) => {
      if (!active) return
      const status = typeof error === 'object' && error !== null && 'response' in error
        ? (error.response as { status?: number } | undefined)?.status
        : undefined
      setState(status === 404 ? { identifier: eventId, status: 'not-found' } : { identifier: eventId, status: 'error' })
    })
    return () => { active = false }
  }, [eventId])

  const pageState: PageState = state.identifier === eventId ? state : { identifier: eventId, status: 'loading' }
  if (pageState.status === 'loading') return <main className="detail-page" aria-live="polite"><p>Loading event details…</p></main>
  if (pageState.status === 'not-found') return <main className="detail-page"><span className="eyebrow">Event unavailable</span><h1>We couldn’t find that event.</h1><Link to="/#discover">Browse events</Link></main>
  if (pageState.status === 'error') return <main className="detail-page" role="alert"><h1>Event details are temporarily unavailable.</h1><Link to="/#discover">Back to event discovery</Link></main>

  const { event, sessions, tickets } = pageState
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId)

  async function beginCheckout(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (!selectedTicket || !isSignedIn) return
    setCheckoutBusy(true)
    setCheckoutMessage('')
    setExpiredReservation(false)
    try {
      if (!registrationKey.current) {
        registrationKey.current = crypto.randomUUID()
        saveCheckoutState(eventId, selectedTicket.id, { key: registrationKey.current, registrationId: null, quantity })
      }
      if (!registrationId.current) {
        const registration = await authenticatedRequest<RegistrationResponse>({
          method: 'POST',
          url: '/registrations',
          headers: { 'Idempotency-Key': registrationKey.current },
          data: { ticketTypeId: selectedTicket.id, quantity: Number(quantity) },
        })
        registrationId.current = registration.data.id
        saveCheckoutState(eventId, selectedTicket.id, { key: registrationKey.current, registrationId: registration.data.id, quantity })
        setRegistrationStarted(true)
      }
      const checkout = await authenticatedRequest<CheckoutResponse>({
        method: 'POST',
        url: `/payments/${encodeURIComponent(registrationId.current)}/checkout`,
        data: contact,
      })
      const action = new URL(checkout.data.checkoutUrl)
      if (!['sandbox.payhere.lk', 'www.payhere.lk'].includes(action.hostname) || action.pathname !== '/pay/checkout' || checkout.data.method !== 'POST') {
        throw new Error('Checkout destination could not be verified.')
      }
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = action.toString()
      for (const [name, value] of Object.entries(checkout.data.fields)) {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = name
        input.value = value
        form.append(input)
      }
      document.body.append(form)
      form.submit()
      form.remove()
    } catch (error) {
      const response = typeof error === 'object' && error !== null && 'response' in error
        ? (error.response as { data?: { message?: string | string[] } } | undefined)?.data?.message
        : undefined
      const message = Array.isArray(response) ? response[0] : typeof response === 'string' ? response : error instanceof Error ? error.message : ''
      setCheckoutMessage(message || 'Checkout could not be started. Please try again.')
      setExpiredReservation(Boolean(message && /reservation has expired|only pending registrations/i.test(message)))
    } finally {
      setCheckoutBusy(false)
    }
  }

  function startNewReservation() {
    registrationKey.current = null
    registrationId.current = null
    if (selectedTicket) clearCheckoutState(eventId, selectedTicket.id)
    setExpiredReservation(false)
    setRegistrationStarted(false)
    setCheckoutMessage('')
  }

  return <main className="detail-page">
    <Link className="back-link" to="/#discover">← All events</Link>
    <div className="event-detail-hero">
      <img src={event.coverImageUrl || heroImage} alt={`${event.title} event`} />
      <div><span className="eyebrow">{event.category.name}</span><h1>{event.title}</h1><p>{formatEventDate(event.startAt, event.timezone)}</p><p>{event.venue} · {event.city}</p></div>
    </div>
    <div className="event-detail-layout">
      <div className="event-detail-main">
        <section><h2>About this event</h2><p className="event-long-description">{event.description}</p></section>
        <section><h2>Schedule</h2>
          {sessions.length ? <ol className="schedule-list">{sessions.map((session) => <li key={session.id}>
            <time>{formatEventDate(session.startAt, event.timezone)} – {new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: safeTimezone(event.timezone) }).format(new Date(session.endAt))}</time>
            <h3>{session.title}</h3>{session.description && <p>{session.description}</p>}
            {(session.speaker || session.venue) && <small>{[session.speaker, session.venue].filter(Boolean).join(' · ')}</small>}
          </li>)}</ol> : <p>Schedule details will be shared closer to the event.</p>}
        </section>
      </div>
      <aside className="ticket-panel" aria-labelledby="ticket-title"><h2 id="ticket-title">Tickets</h2>
        {!tickets.length ? <p>Ticket types are not available yet.</p> : tickets.map((ticket) => <article className="ticket-option" key={ticket.id}>
          <div><strong>{ticket.name}</strong><span>{ticket.currency} {ticket.price}</span></div>
          {ticket.description && <p>{ticket.description}</p>}
          <small>{ticket.isOnSale ? `${ticket.availableQuantity} available` : ticket.availableQuantity < 1 ? 'Sold out' : ticket.salesStartAt ? `On sale ${formatEventDate(ticket.salesStartAt, event.timezone)}` : 'Not currently on sale'}</small>
          <button className="text-button ticket-select" type="button" disabled={!ticket.isOnSale || ticket.availableQuantity < 1 || registrationStarted} onClick={() => {
            setSelectedTicketId(ticket.id)
            const saved = readCheckoutState(eventId, ticket.id)
            registrationKey.current = saved?.key ?? null
            registrationId.current = saved?.registrationId ?? null
            setRegistrationStarted(Boolean(saved?.registrationId))
            setQuantity(saved?.quantity ?? '1')
            setContact((previous) => ({ ...previous, city: previous.city || event.city }))
            setCheckoutMessage('')
          }}>{selectedTicketId === ticket.id ? 'Selected' : 'Choose tickets'}</button>
        </article>)}
        {selectedTicket && <section className="checkout-panel" aria-labelledby="checkout-title">
          <h3 id="checkout-title">Checkout · {selectedTicket.name}</h3>
          {!isLoaded ? <p>Checking your account…</p> : !isSignedIn ? <><p>Sign in to reserve tickets and continue to PayHere.</p><SignInButton mode="modal"><button className="button button--dark" type="button">Sign in</button></SignInButton></> : <form className="checkout-form" onSubmit={beginCheckout}>
            <label>Quantity<input required type="number" min="1" max={selectedTicket.availableQuantity} step="1" value={quantity} disabled={registrationStarted} onChange={(e) => setQuantity(e.target.value)} /></label>
            <p className="checkout-total">Total from current ticket price: <strong>{selectedTicket.currency} {displayTotal(selectedTicket.price, quantity)}</strong></p>
            <div className="checkout-fields">
              <label>First name<input required autoComplete="given-name" value={contact.firstName} onChange={(e) => setContact({ ...contact, firstName: e.target.value })} /></label>
              <label>Last name<input required autoComplete="family-name" value={contact.lastName} onChange={(e) => setContact({ ...contact, lastName: e.target.value })} /></label>
              <label>Phone<input required autoComplete="tel" type="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></label>
              <label>Address<input required autoComplete="street-address" value={contact.address} onChange={(e) => setContact({ ...contact, address: e.target.value })} /></label>
              <label>City<input required autoComplete="address-level2" value={contact.city} onChange={(e) => setContact({ ...contact, city: e.target.value })} /></label>
              <label>Country<input required autoComplete="country-name" value={contact.country} onChange={(e) => setContact({ ...contact, country: e.target.value })} /></label>
            </div>
            {checkoutMessage && <div role="alert" className="checkout-error"><p>{checkoutMessage}</p>{expiredReservation && <button className="text-button" type="button" onClick={startNewReservation}>Start a new reservation</button>}</div>}
            <button className="button" type="submit" disabled={checkoutBusy || !quantity || Number(quantity) < 1 || Number(quantity) > selectedTicket.availableQuantity}>
              {checkoutBusy ? 'Preparing checkout…' : registrationStarted ? 'Retry PayHere checkout' : 'Continue to PayHere'}
            </button>
            <p className="ticket-note">Payment is confirmed only after PayHere notifies Eventora’s server. The return page alone cannot confirm payment.</p>
          </form>}
        </section>}
      </aside>
    </div>
  </main>
}

function safeTimezone(timezone: string): string {
  try { new Intl.DateTimeFormat(undefined, { timeZone: timezone }); return timezone } catch { return 'UTC' }
}

function displayTotal(price: string, quantity: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(price) || !/^\d+$/.test(quantity)) return '—'
  const count = BigInt(quantity)
  const [whole, fraction = ''] = price.split('.')
  const cents = (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))) * count
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`
}

function checkoutStorageKey(eventId: string, ticketTypeId: string) {
  return `eventora-checkout:${eventId}:${ticketTypeId}`
}

function readCheckoutState(eventId: string, ticketTypeId: string) {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(checkoutStorageKey(eventId, ticketTypeId)) ?? 'null')
    if (typeof value === 'object' && value !== null && 'key' in value && typeof value.key === 'string'
      && 'quantity' in value && typeof value.quantity === 'string'
      && 'registrationId' in value && (typeof value.registrationId === 'string' || value.registrationId === null)) {
      return { key: value.key, quantity: value.quantity, registrationId: value.registrationId }
    }
  } catch { /* Ignore unavailable or malformed browser storage. */ }
  return null
}

function saveCheckoutState(eventId: string, ticketTypeId: string, value: { key: string; quantity: string; registrationId: string | null }) {
  try { sessionStorage.setItem(checkoutStorageKey(eventId, ticketTypeId), JSON.stringify(value)) } catch { /* The backend idempotency key still protects this active page session. */ }
}

function clearCheckoutState(eventId: string, ticketTypeId: string) {
  try { sessionStorage.removeItem(checkoutStorageKey(eventId, ticketTypeId)) } catch { /* Ignore unavailable browser storage. */ }
}
