import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@clerk/react'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { Modal } from '../../components/ui/modal'
import { getEventPlaceholder } from '../../lib/placeholders'
import { PageIntro } from '../../components/layout/page-intro'
import { LinkButton } from '../../components/ui/link-button'
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
    async function loadTickets() {
      try {
        const { data } = await authenticatedRequest<TicketSummary[]>({ method: 'GET', url: '/tickets/me' })
        if (active) setTickets(data)
      } catch {
        if (active) setError('Could not load your digital tickets. Please refresh.')
      }
    }
    void loadTickets()
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
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-[var(--text-muted)] font-medium">
        <div className="h-8 w-8 rounded-full border-[3px] border-[rgba(99,102,241,0.2)] border-t-[var(--primary)] animate-[spin_0.8s_linear_infinite]" />
        <p>Loading digital ticket wallet…</p>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-[var(--text-muted)] font-medium">
        <IconTicket style={{ width: '48px', height: '48px', color: 'var(--primary)', marginBottom: '12px' }} />
        <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Sign in to View Tickets</h2>
        <p className="text-muted">Your tickets and QR access passes are linked to your Eventora account.</p>
        <LinkButton to="/sign-in">
          Sign In
        </LinkButton>
      </div>
    )
  }

  return (
    <main className="mx-auto w-full max-w-[1280px] px-6 pt-12 pb-20">
      <PageIntro
        centered
        eyebrow="Your Eventora wallet"
        title="Your digital passes & tickets"
        description="Present your scannable QR pass at the venue door for rapid <1s admission. Single-use and cryptographically verified."
      />

      {error && (
        <div className="mx-auto mb-6 flex max-w-[600px] items-start gap-3 rounded-[var(--radius-md)] border-l-4 border-l-[var(--danger)] bg-white px-[18px] py-3.5 shadow-[0_10px_25px_-5px_rgba(15,23,42,0.2),0_8px_10px_-6px_rgba(15,23,42,0.1)] animate-[toastSlideIn_0.25s_cubic-bezier(0.16,1,0.3,1)]">
          <div className="flex-1">{error}</div>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)] [--button-px:12px] [--button-py:6px] [--button-font-size:13px] [--button-radius:var(--radius-sm)] text-[13px]"
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
          <div className="h-8 w-8 rounded-full border-[3px] border-[rgba(99,102,241,0.2)] border-t-[var(--primary)] animate-[spin_0.8s_linear_infinite]" style={{ margin: '0 auto 12px' }} />
          <p className="text-muted">Loading your tickets…</p>
        </div>
      )}

      {tickets && tickets.length === 0 && (
        <div className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ maxWidth: '600px', margin: '0 auto', padding: '60px', textAlign: 'center' }}>
          <IconTicket style={{ width: '48px', height: '48px', color: 'var(--text-muted)', margin: '0 auto 16px' }} />
          <h3 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700 }}>No Tickets Yet</h3>
          <p className="text-muted" style={{ margin: '0 0 24px', fontSize: '14px' }}>
            When you register for an event, your digital entry pass and verification code will appear here.
          </p>
          <Link to="/discover" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px]">
            Explore Upcoming Events
          </Link>
        </div>
      )}

      {tickets && tickets.length > 0 && (
        <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-6">
          {tickets.map((t) => (
            <article className="relative flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)] before:absolute after:absolute before:top-[130px] after:top-[130px] before:left-[-10px] after:right-[-10px] before:z-[2] after:z-[2] before:h-5 after:h-5 before:w-5 after:w-5 before:rounded-full after:rounded-full before:bg-[var(--surface-alt)] after:bg-[var(--surface-alt)] before:content-[''] after:content-['']" key={t.id}>
              <div className="relative h-[140px] overflow-hidden bg-slate-900">
                <img
                  className="h-full w-full object-cover"
                  src={t.event.coverImageUrl || getEventPlaceholder(t.event.title)}
                  alt={t.event.title}
                />
              </div>

              <div className="flex flex-col gap-3 p-6">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none capitalize border border-[#c7d2fe] bg-[#eef2ff] text-[#4f46e5] [--badge-dot-color:#6366f1]">{t.ticketType.name}</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none capitalize border border-[#a7f3d0] bg-[#ecfdf5] text-[#059669] [--badge-dot-color:#10b981]">
                    <span className="h-[6px] w-[6px] rounded-full bg-[var(--badge-dot-color)]" /> Confirmed
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
                    className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px] [--button-px:12px] [--button-py:6px] [--button-font-size:13px] [--button-radius:var(--radius-sm)] text-[13px]"
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
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none capitalize border border-[#c7d2fe] bg-[#eef2ff] text-[#4f46e5] [--badge-dot-color:#6366f1]" style={{ marginBottom: '20px' }}>
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
