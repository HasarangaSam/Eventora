import { useEffect, useRef, useState, type FormEvent } from 'react'
import { SignInButton, useAuth, useUser } from '@clerk/react'
import { Link, useParams, useSearchParams } from 'react-router'
import { api } from '../../lib/api'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { formatEventDate } from './event-format'
import { getEventPlaceholder } from '../../lib/placeholders'
import { useToast } from '../../components/ui/toast'
import {
  IconCalendar,
  IconMapPin,
  IconShield,
} from '../../components/ui/icons'

interface EventDetails {
  id: string
  slug: string
  title: string
  description: string
  venue: string
  city: string
  startAt: string
  endAt: string
  status?: 'PUBLISHED' | 'CANCELLED' | 'COMPLETED'
  cancellationReason?: string | null
  timezone: string
  coverImageUrl: string | null
  organizerName: string | null
  category: { name: string; slug: string }
}

interface Session {
  id: string
  title: string
  description: string | null
  speaker: string | null
  venue: string | null
  startAt: string
  endAt: string
}

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

interface RegistrationResponse {
  id: string
  status?: 'PENDING' | 'CONFIRMED' | 'EXPIRED'
  reservation?: { status: string; expiresAt: string } | null
}

interface CheckoutResponse {
  checkoutUrl: string
  method: 'POST'
  fields: Record<string, string>
}

type PageState =
  | { identifier: string; status: 'loading' }
  | { identifier: string; status: 'ready'; event: EventDetails; sessions: Session[]; tickets: TicketType[]; organizerPreview: boolean }
  | { identifier: string; status: 'not-found' }
  | { identifier: string; status: 'error' }

export function EventDetailPage() {
  const { eventId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const organizerPreview = searchParams.get('preview') === 'organizer'
  const { isLoaded, isSignedIn } = useAuth()
  const { user: clerkUser } = useUser()
  const authenticatedRequest = useAuthenticatedApi()
  const toast = useToast()

  const [state, setState] = useState<PageState>({ identifier: '', status: 'loading' })
  const [selectedTicketId, setSelectedTicketId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [contact, setContact] = useState<CheckoutContact>({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    city: '',
    country: 'Sri Lanka',
  })
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [registrationStarted, setRegistrationStarted] = useState(false)
  const [reservationExpiresAt, setReservationExpiresAt] = useState<string | null>(null)
  const [reservationSeconds, setReservationSeconds] = useState<number | null>(null)
  const [reservationExpired, setReservationExpired] = useState(false)
  const registrationKey = useRef<string | null>(null)
  const registrationId = useRef<string | null>(null)

  useEffect(() => {
    setContact((current) => ({ ...current, firstName: current.firstName || clerkUser?.firstName || '', lastName: current.lastName || clerkUser?.lastName || '' }))
  }, [clerkUser?.firstName, clerkUser?.lastName])

  useEffect(() => {
    if (!reservationExpiresAt) { setReservationSeconds(null); return }
    const update = () => {
      const seconds = Math.max(0, Math.ceil((new Date(reservationExpiresAt).getTime() - Date.now()) / 1000))
      setReservationSeconds(seconds)
      setReservationExpired(seconds === 0)
    }
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [reservationExpiresAt])

  useEffect(() => {
    if (!eventId || !selectedTicketId || !isSignedIn || registrationKey.current) return
    const saved = readCheckoutState(eventId, selectedTicketId)
    if (!saved) return
    registrationKey.current = saved.key
    registrationId.current = saved.registrationId
    setQuantity(saved.quantity)
    if (!saved.registrationId) return
    let active = true
    authenticatedRequest<RegistrationResponse>({ method: 'GET', url: `/registrations/${encodeURIComponent(saved.registrationId)}` }).then(({ data }) => {
      if (!active) return
      if (data.status === 'PENDING' && data.reservation?.status === 'HELD') {
        setRegistrationStarted(true)
        setReservationExpiresAt(data.reservation.expiresAt)
      } else if (data.status === 'CONFIRMED') {
        window.location.assign(`/checkout/result?registrationId=${encodeURIComponent(saved.registrationId!)}`)
      } else {
        clearCheckoutState(eventId, selectedTicketId)
        registrationId.current = null
        registrationKey.current = null
      }
    }).catch(() => {
      if (!active) return
      clearCheckoutState(eventId, selectedTicketId)
      registrationId.current = null
      registrationKey.current = null
    })
    return () => { active = false }
  }, [authenticatedRequest, eventId, isSignedIn, selectedTicketId])

  useEffect(() => {
    let active = true
    async function loadEventDetails() {
      try {
        let event: EventDetails
        let sessions: Session[]
        let tickets: TicketType[]
        if (organizerPreview) {
          const response = await authenticatedRequest<{
            id: string; slug: string; title: string; description: string; venue: string; city: string; startAt: string; endAt: string; timezone: string; coverImageUrl: string | null; capacity: number | null; ticketsReserved: number; ticketsSold: number;
            category: { name: string; slug: string }; sessions: Session[];
            ticketTypes: { id: string; name: string; description: string | null; price: string; currency: string; quantity: number; quantityReserved: number; quantitySold: number; isActive: boolean; salesStartAt: string | null; salesEndAt: string | null }[];
          }>({ method: 'GET', url: `/organizer/events/${encodeURIComponent(eventId)}` })
          const value = response.data
          event = { id: value.id, slug: value.slug, title: value.title, description: value.description, venue: value.venue, city: value.city, startAt: value.startAt, endAt: value.endAt, timezone: value.timezone, coverImageUrl: value.coverImageUrl, organizerName: null, category: value.category }
          sessions = value.sessions
          const now = Date.now()
          const eventRemaining = value.capacity === null ? Number.MAX_SAFE_INTEGER : Math.max(0, value.capacity - value.ticketsReserved - value.ticketsSold)
          tickets = value.ticketTypes.filter((ticket) => ticket.isActive && Number(ticket.price) > 0).map((ticket) => ({
            id: ticket.id, name: ticket.name, description: ticket.description, price: ticket.price, currency: ticket.currency,
            salesStartAt: ticket.salesStartAt, salesEndAt: ticket.salesEndAt,
            availableQuantity: Math.max(0, Math.min(ticket.quantity - ticket.quantityReserved - ticket.quantitySold, eventRemaining)),
            isOnSale: (!ticket.salesStartAt || new Date(ticket.salesStartAt).getTime() <= now) && (!ticket.salesEndAt || new Date(ticket.salesEndAt).getTime() > now),
          }))
        } else {
          const [eventResponse, sessionResponse, ticketResponse] = await Promise.all([
            api.get<EventDetails>(`/events/${encodeURIComponent(eventId)}`),
            api.get<Session[]>(`/events/${encodeURIComponent(eventId)}/sessions`),
            api.get<TicketType[]>(`/events/${encodeURIComponent(eventId)}/ticket-types`),
          ])
          event = eventResponse.data
          sessions = sessionResponse.data
          tickets = ticketResponse.data
        }
        if (active) {
          setState({
            identifier: eventId,
            status: 'ready',
            event,
            sessions,
            tickets,
            organizerPreview,
          })
          if (tickets.length > 0 && !selectedTicketId) {
            const firstAvailable = tickets.find((t) => t.isOnSale && t.availableQuantity > 0)
            if (firstAvailable) setSelectedTicketId(firstAvailable.id)
          }
        }
      } catch (error: unknown) {
        if (!active) return
        const status =
          typeof error === 'object' && error !== null && 'response' in error
            ? (error.response as { status?: number } | undefined)?.status
            : undefined
        setState(status === 404 ? { identifier: eventId, status: 'not-found' } : { identifier: eventId, status: 'error' })
      }
    }
    void loadEventDetails()

    return () => {
      active = false
    }
  }, [eventId, selectedTicketId, organizerPreview, authenticatedRequest])

  const pageState: PageState = state.identifier === eventId ? state : { identifier: eventId, status: 'loading' }

  if (pageState.status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-[var(--text-muted)] font-medium">
        <div className="h-8 w-8 rounded-full border-[3px] border-[rgba(99,102,241,0.2)] border-t-[var(--primary)] animate-[spin_0.8s_linear_infinite]" />
        <p>Loading event information…</p>
      </div>
    )
  }

  if (pageState.status === 'not-found') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-[var(--text-muted)] font-medium">
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none capitalize border border-[#fecaca] bg-[#fef2f2] text-[#dc2626] [--badge-dot-color:#ef4444]">Event Not Found</span>
        <h2 style={{ fontSize: '24px', fontWeight: 800 }}>We couldn't locate this event</h2>
        <p className="text-muted">The link may have expired or the event may have been unpublished.</p>
        <Link to="/discover" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px]">
          Explore Other Events
        </Link>
      </div>
    )
  }

  if (pageState.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-[var(--text-muted)] font-medium">
        <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Event details are temporarily unavailable</h2>
        <Link to="/discover" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)]">
          Back to Events
        </Link>
      </div>
    )
  }

  const { event, sessions, tickets } = pageState
  const previewMode = pageState.organizerPreview
  const selectedTicket = tickets.find((t) => t.id === selectedTicketId)
  const coverImage = event.coverImageUrl || getEventPlaceholder(event.category.name)

  async function beginCheckout(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (previewMode || !selectedTicket || !isSignedIn) return
    setCheckoutBusy(true)

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
        setReservationExpiresAt(registration.data.reservation?.expiresAt ?? null)
        setReservationExpired(false)
        saveCheckoutState(eventId, selectedTicket.id, {
          key: registrationKey.current,
          registrationId: registration.data.id,
          quantity,
        })
        setRegistrationStarted(true)
      }

      const checkout = await authenticatedRequest<CheckoutResponse>({
        method: 'POST',
        url: `/payments/${encodeURIComponent(registrationId.current)}/checkout`,
        data: contact,
      })

      const action = new URL(checkout.data.checkoutUrl)
      if (
        !['sandbox.payhere.lk', 'www.payhere.lk'].includes(action.hostname) ||
        action.pathname !== '/pay/checkout' ||
        checkout.data.method !== 'POST'
      ) {
        throw new Error('Checkout destination could not be validated.')
      }

      toast.info('Redirecting to PayHere', 'Secure payment gateway is loading…', 3000)

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
    } catch (err) {
      const response =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err.response as { data?: { message?: string | string[] } } | undefined)?.data?.message
          : undefined
      const message =
        Array.isArray(response) ? response[0] : typeof response === 'string' ? response : err instanceof Error ? err.message : ''
      toast.error('Checkout Error', message || 'Checkout could not be started. Please try again.')
    } finally {
      setCheckoutBusy(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-8">
      <Link to={previewMode ? `/organizer/events/${event.id}/edit` : '/discover'} className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border-0 bg-transparent px-2 py-1 text-[13px] font-semibold text-[var(--text-button-color,var(--primary))] cursor-pointer transition-[all] duration-150 hover:bg-[var(--text-button-bg,var(--primary-light))] hover:text-[var(--text-button-hover,var(--primary-hover))]" style={{ marginBottom: '20px' }}>
        {previewMode ? '← Back to event editor' : '← All Events'}
      </Link>

      {previewMode && <div role="status" className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900"><strong>Organizer preview</strong> · This is how the attendee page will look. Checkout is disabled in preview mode.</div>}
      {!previewMode && (event.status === 'CANCELLED' || event.status === 'COMPLETED' || new Date(event.endAt) <= new Date()) && <div role="status" className={`mb-5 rounded-xl border px-4 py-3 text-sm ${event.status === 'CANCELLED' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-slate-200 bg-slate-100 text-slate-700'}`}><strong>{event.status === 'CANCELLED' ? 'This event was cancelled' : 'This event has ended'}</strong>{event.status === 'CANCELLED' && event.cancellationReason ? ` · ${event.cancellationReason}` : ''} · Ticket sales are closed. Existing bookings remain in your account history.</div>}

      {/* Hero Banner */}
      <div className="relative mb-10 h-[420px] overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)]">
        <img className="h-full w-full object-cover" src={coverImage} alt={event.title} />
        <div className="absolute inset-0 flex flex-col justify-end bg-[linear-gradient(180deg,rgba(15,23,42,0.2)_0%,rgba(15,23,42,0.85)_100%)] p-10 text-white">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none capitalize border border-[#c7d2fe] bg-[#eef2ff] text-[#4f46e5] [--badge-dot-color:#6366f1]" style={{ alignSelf: 'flex-start', marginBottom: '12px' }}>
            {event.category.name}
          </span>
          <h1 style={{ margin: '0 0 12px', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, lineHeight: 1.15 }}>
            {event.title}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', fontSize: '15px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconCalendar style={{ width: '18px', height: '18px' }} />
              {formatEventDate(event.startAt, event.timezone)}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconMapPin style={{ width: '18px', height: '18px' }} />
              {event.venue}, {event.city}
            </span>
          </div>
        </div>
      </div>

      {/* Layout Content & Sticky Ticket Card */}
      <div className="mb-12 grid min-w-0 grid-cols-1 items-start gap-6 lg:mb-20 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
        {/* Left Column: Details & Agenda */}
        <div>
          <section className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-sm)] sm:p-6 lg:p-8" style={{ marginBottom: '32px' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '20px', fontWeight: 800 }}>About this Event</h2>
            <p style={{ margin: '0 0 24px', fontSize: '15px', lineHeight: 1.7, color: 'var(--text-main)', whiteSpace: 'pre-line' }}>
              {event.description}
            </p>
            {event.organizerName && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', fontSize: '14px', color: 'var(--text-muted)' }}>
                Organized by <strong style={{ color: 'var(--text-main)' }}>{event.organizerName}</strong>
              </div>
            )}
          </section>

          {/* Agenda / Schedule */}
          <section className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-sm)] sm:p-6 lg:p-8">
            <h2 style={{ margin: '0 0 20px', fontSize: '20px', fontWeight: 800 }}>Event Schedule</h2>
            {sessions.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-slate-50 p-4 sm:flex-row sm:gap-4"
                  >
                    <div className="text-[13px] font-semibold text-[var(--primary)] sm:min-w-[120px]">
                      {new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: safeTimezone(event.timezone) }).format(new Date(s.startAt))}
                      {' – '}
                      {new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: safeTimezone(event.timezone) }).format(new Date(s.endAt))}
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700 }}>{s.title}</h4>
                      {s.description && <p style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--text-muted)' }}>{s.description}</p>}
                      {(s.speaker || s.venue) && (
                        <span className="text-muted" style={{ fontSize: '12px' }}>
                          {[s.speaker, s.venue].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted" style={{ margin: 0 }}>
                Schedule sessions will be announced closer to the event date.
              </p>
            )}
          </section>
        </div>

        {/* Right Sticky Column: Ticket Booking Panel */}
        <aside>
          <div className="sticky top-[94px] rounded-[var(--radius-xl)] border border-[var(--border)] bg-white p-7 shadow-[var(--shadow-md)]">
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 800 }}>{previewMode ? 'Ticket Options Preview' : 'Choose tickets'}</h3>

            {/* Ticket Tier Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {tickets.map((t) => {
                const isSelected = selectedTicketId === t.id
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      if (t.isOnSale && t.availableQuantity > 0) {
                        setSelectedTicketId(t.id)
                      }
                    }}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-md)',
                      border: '2px solid',
                      borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                      background: isSelected ? '#eef2ff' : '#ffffff',
                      cursor: t.isOnSale && t.availableQuantity > 0 ? 'pointer' : 'not-allowed',
                      opacity: t.isOnSale && t.availableQuantity > 0 ? 1 : 0.6,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '15px' }}>{t.name}</strong>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)' }}>
                        {t.currency} {Number(t.price).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
                      {t.isOnSale && t.availableQuantity > 0
                        ? `${t.availableQuantity} passes left`
                      : t.availableQuantity < 1 ? 'Sold out' : t.salesStartAt ? `Sales open ${new Date(t.salesStartAt).toLocaleString()}` : 'Not currently on sale'}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Checkout Form */}
            {previewMode ? <div className="mt-2 rounded-lg bg-slate-50 p-4">
              {tickets.length === 0 ? <p className="m-0 text-sm text-slate-600">No active paid ticket tiers are available to display yet.</p> : selectedTicket ? <>
                <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="preview-quantity">Ticket quantity</label>
                <input id="preview-quantity" type="number" min="1" max={selectedTicket.availableQuantity || 1} value={quantity} onChange={(event) => setQuantity(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" />
                <div className="mt-3 flex justify-between text-sm"><span className="text-slate-600">Estimated total</span><strong className="text-indigo-700">{selectedTicket.currency} {displayTotal(selectedTicket.price, quantity)}</strong></div>
                <button type="button" disabled className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white opacity-60">Checkout preview only</button>
                <p className="mb-0 mt-2 text-center text-xs text-slate-500">Preview mode does not reserve tickets or charge a payment method.</p>
              </> : <p className="m-0 text-sm text-slate-600">Select an available ticket tier to preview its checkout total.</p>}
            </div> : selectedTicket && (
              <>
                {registrationStarted && reservationSeconds !== null && <div role="status" className={`mb-4 rounded-lg border px-3 py-2.5 text-sm ${reservationExpired ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                  {reservationExpired ? 'Your 10-minute ticket hold expired. Start a new reservation to continue.' : <>Tickets held for <strong>{Math.floor(reservationSeconds / 60)}:{String(reservationSeconds % 60).padStart(2, '0')}</strong>. Complete PayHere checkout before the timer ends.</>}
                </div>}
                {!isLoaded ? (
                  <p className="text-muted">Loading account session…</p>
                ) : !isSignedIn ? (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <p className="text-muted" style={{ fontSize: '14px', marginBottom: '14px' }}>
                      Sign in to reserve tickets and proceed to secure checkout.
                    </p>
                    <SignInButton mode="modal">
                      <button type="button" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px]" style={{ width: '100%' }}>
                        Sign In to Book
                      </button>
                    </SignInButton>
                  </div>
                ) : (
                  <form onSubmit={beginCheckout}>
                    <div className="mb-[18px] flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[var(--text-main)]">Ticket Quantity</label>
                      <input
                        required
                        type="number"
                        min="1"
                        max={selectedTicket.availableQuantity}
                        className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                        value={quantity}
                        disabled={registrationStarted}
                        onChange={(e) => setQuantity(e.target.value)}
                      />
                    </div>

                    <div
                      style={{
                        padding: '12px 16px',
                        background: '#f8fafc',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span className="text-muted" style={{ fontSize: '14px' }}>Total Amount</span>
                      <strong style={{ fontSize: '18px', color: 'var(--primary)' }}>
                        {selectedTicket.currency} {displayTotal(selectedTicket.price, quantity)}
                      </strong>
                    </div>

                    {/* Attendee Details Form */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                      <div className="mb-[18px] grid gap-3 sm:grid-cols-2 sm:gap-[18px]">
                        <input
                          required
                          className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                          placeholder="First Name"
                          aria-label="First name for payment"
                          value={contact.firstName}
                          onChange={(e) => setContact({ ...contact, firstName: e.target.value })}
                        />
                        <input
                          required
                          className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                          placeholder="Last Name"
                          aria-label="Last name for payment"
                          value={contact.lastName}
                          onChange={(e) => setContact({ ...contact, lastName: e.target.value })}
                        />
                      </div>
                      <input
                        required
                        type="tel"
                        className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                        placeholder="Phone Number"
                        aria-label="Phone number for payment"
                        value={contact.phone}
                        onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                      />
                      <input
                        required
                        className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                        placeholder="Billing Address"
                        aria-label="Billing address for payment"
                        value={contact.address}
                        onChange={(e) => setContact({ ...contact, address: e.target.value })}
                      />
                      <div className="mb-[18px] grid gap-3 sm:grid-cols-2 sm:gap-[18px]">
                        <input
                          required
                          className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                          placeholder="City"
                          aria-label="Billing city"
                          value={contact.city}
                          onChange={(e) => setContact({ ...contact, city: e.target.value })}
                        />
                        <input
                          required
                          className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                          placeholder="Country"
                          aria-label="Billing country"
                          value={contact.country}
                          onChange={(e) => setContact({ ...contact, country: e.target.value })}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px]"
                      style={{ width: '100%', padding: '14px' }}
                      disabled={
                        checkoutBusy ||
                        reservationExpired ||
                        !quantity ||
                        Number(quantity) < 1 ||
                        Number(quantity) > selectedTicket.availableQuantity
                      }
                    >
                      {checkoutBusy ? 'Preparing Checkout…' : reservationExpired ? 'Reservation expired' : 'Continue to PayHere'}
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', marginTop: '12px', color: 'var(--text-muted)', fontSize: '12px' }}>
                      <IconShield style={{ width: '14px', height: '14px' }} />
                      Secure checkout with PayHere
                    </div>
                    <p className="mb-0 mt-2 text-center text-xs leading-5 text-slate-500">Your order total is shown above. PayHere will display the payment methods available for this order before you confirm payment.</p>
                    {reservationExpired && <button type="button" className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => { clearCheckoutState(eventId, selectedTicket.id); registrationKey.current = null; registrationId.current = null; setRegistrationStarted(false); setReservationExpiresAt(null); setReservationExpired(false) }}>Start a new reservation</button>}
                  </form>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </main>
  )
}

function safeTimezone(tz: string): string {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz })
    return tz
  } catch {
    return 'UTC'
  }
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

function saveCheckoutState(eventId: string, ticketTypeId: string, value: { key: string; quantity: string; registrationId: string | null }) {
  try {
    sessionStorage.setItem(checkoutStorageKey(eventId, ticketTypeId), JSON.stringify(value))
  } catch {}
}

function readCheckoutState(eventId: string, ticketTypeId: string): { key: string; quantity: string; registrationId: string | null } | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(checkoutStorageKey(eventId, ticketTypeId)) ?? 'null') as { key?: string; quantity?: string; registrationId?: string | null } | null
    if (value && typeof value.key === 'string' && typeof value.quantity === 'string' && (value.registrationId === null || typeof value.registrationId === 'string')) return { key: value.key, quantity: value.quantity, registrationId: value.registrationId ?? null }
  } catch {}
  return null
}

function clearCheckoutState(eventId: string, ticketTypeId: string) { try { sessionStorage.removeItem(checkoutStorageKey(eventId, ticketTypeId)) } catch {} }
