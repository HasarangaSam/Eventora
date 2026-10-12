import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api } from '../../lib/api'
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

type PageState =
  | { identifier: string; status: 'loading' }
  | { identifier: string; status: 'ready'; event: EventDetails; sessions: Session[]; tickets: TicketType[] }
  | { identifier: string; status: 'not-found' }
  | { identifier: string; status: 'error' }

export function EventDetailPage() {
  const { eventId = '' } = useParams()
  const [state, setState] = useState<PageState>({ identifier: '', status: 'loading' })

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
        </article>)}
        <p className="ticket-note">Checkout will be available when registration opens.</p>
      </aside>
    </div>
  </main>
}

function safeTimezone(timezone: string): string {
  try { new Intl.DateTimeFormat(undefined, { timeZone: timezone }); return timezone } catch { return 'UTC' }
}
