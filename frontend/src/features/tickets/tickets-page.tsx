import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@clerk/react'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'

interface TicketSummary {
  id: string
  reference: string
  status: string
  issuedAt: string
  event: { title: string; startAt: string; endAt: string; venue: string; city: string; timezone: string; coverImageUrl: string | null; status: string }
  ticketType: { name: string }
}
interface TicketDetails extends TicketSummary { qrCode: string }

export function TicketsPage() {
  const { isLoaded, isSignedIn } = useAuth()
  const authenticatedRequest = useAuthenticatedApi()
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null)
  const [selected, setSelected] = useState<TicketDetails | null>(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    let active = true
    authenticatedRequest<TicketSummary[]>({ method: 'GET', url: '/tickets/me' })
      .then(({ data }) => { if (active) setTickets(data) })
      .catch(() => { if (active) setError('Your tickets could not be loaded. Please retry.') })
    return () => { active = false }
  }, [authenticatedRequest, isLoaded, isSignedIn, reload])

  async function openTicket(ticket: TicketSummary) {
    setError('')
    try {
      const { data } = await authenticatedRequest<TicketDetails>({ method: 'GET', url: `/tickets/${encodeURIComponent(ticket.id)}` })
      setSelected(data)
    } catch {
      setError('Ticket details could not be loaded. Please retry.')
    }
  }

  if (!isLoaded) return <main className="ticket-wallet" aria-live="polite"><p>Checking your account…</p></main>
  if (!isSignedIn) return <main className="ticket-wallet"><span className="eyebrow">Your Eventora tickets</span><h1>Sign in to view your tickets.</h1><Link className="button button--dark" to="/">Explore events</Link></main>

  return <main className="ticket-wallet" aria-labelledby="ticket-wallet-title">
    <span className="eyebrow">Good plans, ready to go</span>
    <h1 id="ticket-wallet-title">Your tickets.</h1>
    <p className="ticket-wallet__intro">Only tickets from confirmed payments appear here. Keep QR codes private and have them ready at the door.</p>
    {!tickets && !error && <p aria-live="polite">Loading your tickets…</p>}
    {error && <p role="alert" className="ticket-wallet__error">{error} <button className="text-button" onClick={() => { setError(''); setReload((value) => value + 1) }} type="button">Try again</button></p>}
    {tickets?.length === 0 && <div className="ticket-wallet__empty"><p>No tickets yet.</p><Link to="/#discover">Find an event</Link></div>}
    {tickets && tickets.length > 0 && <div className="ticket-wallet__layout">
      <div className="ticket-wallet__list" aria-label="Your tickets">
        {tickets.map((ticket) => <article className="ticket-wallet__item" key={ticket.id}>
          {ticket.event.coverImageUrl && <img src={ticket.event.coverImageUrl} alt="" />}
          <div><span className="eyebrow">{ticket.ticketType.name}</span><h2>{ticket.event.title}</h2><p>{formatEventDate(ticket.event.startAt, ticket.event.timezone)}</p><p className="ticket-wallet__reference">{ticket.reference}</p></div>
          <button type="button" className="button button--dark" onClick={() => void openTicket(ticket)}>Show ticket</button>
        </article>)}
      </div>
      {selected && <section className="ticket-wallet__detail" aria-label={`Ticket ${selected.reference}`}>
        <button type="button" className="text-button" onClick={() => setSelected(null)}>Close</button>
        <h2>{selected.event.title}</h2>
        <p>{selected.ticketType.name} · {selected.reference}</p>
        <p>{formatEventDate(selected.event.startAt, selected.event.timezone)}</p>
        <p>{selected.event.venue}, {selected.event.city}</p>
        {selected.event.status === 'CANCELLED' && <p className="ticket-wallet__error">This event has been cancelled. Your ticket history remains available.</p>}
        <img className="ticket-wallet__qr" src={selected.qrCode} alt={`Secure entry code for ticket ${selected.reference}`} />
        <p className="ticket-wallet__note">The QR code is verified by Eventora at check-in. Keep this page private.</p>
      </section>}
    </div>}
  </main>
}

function formatEventDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short', timeZone: timezone }).format(new Date(value))
}
