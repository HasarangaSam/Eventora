import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@clerk/react'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { Modal } from '../../components/ui/modal'
import { getEventPlaceholder } from '../../lib/placeholders'
import {
  IconCalendar,
  IconMapPin,
  IconTicket,
  IconQrCode,
  IconShield,
} from '../../components/ui/icons'

interface TicketSummary {
  id: string
  reference: string
  status: string
  issuedAt: string
  event: {
    title: string
    startAt: string
    endAt: string
    venue: string
    city: string
    timezone: string
    coverImageUrl: string | null
    status: string
  }
  ticketType: { name: string }
}

interface TicketDetails extends TicketSummary {
  qrCode: string
}

export function TicketsPage() {
  const { isLoaded, isSignedIn } = useAuth()
  const authenticatedRequest = useAuthenticatedApi()
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null)
  const [selected, setSelected] = useState<TicketDetails | null>(null)
  const [loadingModal, setLoadingModal] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    let active = true
    authenticatedRequest<TicketSummary[]>({ method: 'GET', url: '/tickets/me' })
      .then(({ data }) => {
        if (active) setTickets(data)
      })
      .catch(() => {
        if (active) setError('Could not load your digital tickets. Please refresh.')
      })
    return () => {
      active = false
    }
  }, [authenticatedRequest, isLoaded, isSignedIn, reload])

  async function openTicket(ticket: TicketSummary) {
    setLoadingModal(true)
    try {
      const { data } = await authenticatedRequest<TicketDetails>({
        method: 'GET',
        url: `/tickets/${encodeURIComponent(ticket.id)}`,
      })
      setSelected(data)
    } catch {
      setError('Could not retrieve secure QR code.')
    } finally {
      setLoadingModal(false)
    }
  }

  if (!isLoaded) {
    return (
      <div className="fullscreen-loading">
        <div className="spinner" />
        <p>Loading digital ticket wallet…</p>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="fullscreen-loading">
        <IconTicket style={{ width: '48px', height: '48px', color: 'var(--primary)', marginBottom: '12px' }} />
        <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Sign in to View Tickets</h2>
        <p className="text-muted">Your tickets and QR access passes are linked to your Eventora account.</p>
        <Link to="/sign-in" className="btn btn-primary">
          Sign In
        </Link>
      </div>
    )
  }

  return (
    <main className="public-container ticket-wallet-page">
      <div style={{ maxWidth: '800px', margin: '0 auto 40px', textAlign: 'center' }}>
        <h1 style={{ margin: '0 0 10px', fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.8px' }}>
          Your Digital Passes &amp; Tickets
        </h1>
        <p className="text-muted" style={{ margin: 0, fontSize: '15px' }}>
          Present your scannable QR pass at the venue door for rapid &lt;1s admission. Single-use and cryptographically verified.
        </p>
      </div>

      {error && (
        <div className="toast-card toast-card--error" style={{ maxWidth: '600px', margin: '0 auto 24px' }}>
          <div className="toast-card__content">{error}</div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setError('')
              setReload((r) => r + 1)
            }}
          >
            Retry
          </button>
        </div>
      )}

      {!tickets && (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p className="text-muted">Loading your tickets…</p>
        </div>
      )}

      {tickets && tickets.length === 0 && (
        <div className="table-card" style={{ maxWidth: '600px', margin: '0 auto', padding: '60px', textAlign: 'center' }}>
          <IconTicket style={{ width: '48px', height: '48px', color: 'var(--text-muted)', margin: '0 auto 16px' }} />
          <h3 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700 }}>No Tickets Yet</h3>
          <p className="text-muted" style={{ margin: '0 0 24px', fontSize: '14px' }}>
            When you register for an event, your digital entry pass and verification code will appear here.
          </p>
          <Link to="/discover" className="btn btn-primary">
            Explore Upcoming Events
          </Link>
        </div>
      )}

      {tickets && tickets.length > 0 && (
        <div className="ticket-wallet-grid">
          {tickets.map((t) => (
            <article className="wallet-ticket-card" key={t.id}>
              <div className="wallet-ticket-cover">
                <img
                  src={t.event.coverImageUrl || getEventPlaceholder(t.event.title)}
                  alt={t.event.title}
                />
              </div>

              <div className="wallet-ticket-info">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge badge-indigo">{t.ticketType.name}</span>
                  <span className="badge badge-emerald">
                    <span className="badge-dot" /> Confirmed
                  </span>
                </div>

                <h3 style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 700 }}>{t.event.title}</h3>

                <div className="text-muted" style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <IconCalendar style={{ width: '14px', height: '14px' }} />
                    {formatEventDate(t.event.startAt, t.event.timezone)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <IconMapPin style={{ width: '14px', height: '14px' }} />
                    {t.event.venue}, {t.event.city}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '16px',
                    borderTop: '1px dashed var(--border)',
                    marginTop: '8px',
                  }}
                >
                  <code style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                    {t.reference}
                  </code>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => void openTicket(t)}
                    disabled={loadingModal}
                  >
                    <IconQrCode /> View Pass
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* QR Code Pass Modal */}
      {selected && (
        <Modal
          isOpen={Boolean(selected)}
          onClose={() => setSelected(null)}
          title={`Digital Entry Pass — ${selected.reference}`}
        >
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 800 }}>{selected.event.title}</h4>
            <span className="badge badge-indigo" style={{ marginBottom: '20px' }}>
              {selected.ticketType.name} · {selected.reference}
            </span>

            <div
              style={{
                background: '#ffffff',
                padding: '24px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                display: 'inline-block',
                boxShadow: 'var(--shadow-md)',
                marginBottom: '20px',
              }}
            >
              <img
                src={selected.qrCode}
                alt={`Entry code for ${selected.reference}`}
                style={{ width: '220px', height: '220px', display: 'block' }}
              />
            </div>

            <div className="text-muted" style={{ fontSize: '13px', lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 6px' }}>
                <strong>{selected.event.venue}, {selected.event.city}</strong>
              </p>
              <p style={{ margin: '0 0 16px' }}>
                {formatEventDate(selected.event.startAt, selected.event.timezone)}
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  justifyContent: 'center',
                  color: 'var(--success)',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <IconShield style={{ width: '14px', height: '14px' }} />
                Encrypted single-use admission QR token
              </div>
            </div>
          </div>
        </Modal>
      )}
    </main>
  )
}

function formatEventDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short', timeZone: timezone }).format(
    new Date(value),
  )
}
