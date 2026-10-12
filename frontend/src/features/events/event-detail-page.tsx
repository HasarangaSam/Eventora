import { useEffect, useRef, useState, type FormEvent } from 'react'
import { SignInButton, useAuth } from '@clerk/react'
import { Link, useParams } from 'react-router'
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
}

interface CheckoutResponse {
  checkoutUrl: string
  method: 'POST'
  fields: Record<string, string>
}

type PageState =
  | { identifier: string; status: 'loading' }
  | { identifier: string; status: 'ready'; event: EventDetails; sessions: Session[]; tickets: TicketType[] }
  | { identifier: string; status: 'not-found' }
  | { identifier: string; status: 'error' }

export function EventDetailPage() {
  const { eventId = '' } = useParams()
  const { isLoaded, isSignedIn } = useAuth()
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
  const registrationKey = useRef<string | null>(null)
  const registrationId = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    async function loadEventDetails() {
      try {
        const [eventResponse, sessionResponse, ticketResponse] = await Promise.all([
          api.get<EventDetails>(`/events/${encodeURIComponent(eventId)}`),
          api.get<Session[]>(`/events/${encodeURIComponent(eventId)}/sessions`),
          api.get<TicketType[]>(`/events/${encodeURIComponent(eventId)}/ticket-types`),
        ])
        if (active) {
          setState({
            identifier: eventId,
            status: 'ready',
            event: eventResponse.data,
            sessions: sessionResponse.data,
            tickets: ticketResponse.data,
          })
          if (ticketResponse.data.length > 0 && !selectedTicketId) {
            const firstAvailable = ticketResponse.data.find((t) => t.isOnSale && t.availableQuantity > 0)
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
  }, [eventId, selectedTicketId])

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
  const selectedTicket = tickets.find((t) => t.id === selectedTicketId)
  const coverImage = event.coverImageUrl || getEventPlaceholder(event.category.name)

  async function beginCheckout(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedTicket || !isSignedIn) return
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
    <main className="mx-auto w-full max-w-[1280px] px-6" style={{ padding: '32px 24px 80px' }}>
      <Link to="/discover" className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border-0 bg-transparent px-2 py-1 text-[13px] font-semibold text-[var(--text-button-color,var(--primary))] cursor-pointer transition-[all] duration-150 hover:bg-[var(--text-button-bg,var(--primary-light))] hover:text-[var(--text-button-hover,var(--primary-hover))]" style={{ marginBottom: '20px' }}>
        ← All Events
      </Link>

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
      <div className="mb-20 grid grid-cols-[1fr_380px] gap-12">
        {/* Left Column: Details & Agenda */}
        <div>
          <section className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ padding: '32px', marginBottom: '32px' }}>
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
          <section className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ padding: '32px' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '20px', fontWeight: 800 }}>Event Schedule</h2>
            {sessions.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      gap: '16px',
                      padding: '16px',
                      background: '#f8fafc',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ minWidth: '120px', fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>
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
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 800 }}>Reserve Your Tickets</h3>

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
                        : 'Sold out / Not on sale'}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Checkout Form */}
            {selectedTicket && (
              <>
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
                      <div className="mb-[18px] grid grid-cols-2 gap-[18px]">
                        <input
                          required
                          className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                          placeholder="First Name"
                          value={contact.firstName}
                          onChange={(e) => setContact({ ...contact, firstName: e.target.value })}
                        />
                        <input
                          required
                          className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                          placeholder="Last Name"
                          value={contact.lastName}
                          onChange={(e) => setContact({ ...contact, lastName: e.target.value })}
                        />
                      </div>
                      <input
                        required
                        type="tel"
                        className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                        placeholder="Phone Number"
                        value={contact.phone}
                        onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                      />
                      <input
                        required
                        className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                        placeholder="Billing Address"
                        value={contact.address}
                        onChange={(e) => setContact({ ...contact, address: e.target.value })}
                      />
                      <div className="mb-[18px] grid grid-cols-2 gap-[18px]">
                        <input
                          required
                          className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                          placeholder="City"
                          value={contact.city}
                          onChange={(e) => setContact({ ...contact, city: e.target.value })}
                        />
                        <input
                          required
                          className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                          placeholder="Country"
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
                        !quantity ||
                        Number(quantity) < 1 ||
                        Number(quantity) > selectedTicket.availableQuantity
                      }
                    >
                      {checkoutBusy ? 'Preparing Checkout…' : 'Proceed to PayHere Checkout'}
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', marginTop: '12px', color: 'var(--text-muted)', fontSize: '12px' }}>
                      <IconShield style={{ width: '14px', height: '14px' }} />
                      256-bit encrypted PayHere checkout
                    </div>
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
