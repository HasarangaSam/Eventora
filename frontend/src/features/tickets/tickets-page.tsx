import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@clerk/react'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { Modal } from '../../components/ui/modal'
import { getEventPlaceholder } from '../../lib/placeholders'
import { PageIntro } from '../../components/layout/page-intro'
import { LinkButton } from '../../components/ui/link-button'
import { IconSearch } from '../../components/ui/icons'
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
    slug: string
    title: string
    startAt: string
    endAt: string
    venue: string
    city: string
    timezone: string
    coverImageUrl: string | null
    status: string
    cancellationReason: string | null
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
  const [view, setView] = useState<'UPCOMING' | 'PAST' | 'CANCELLED' | 'ALL'>('UPCOMING')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageInfo, setPageInfo] = useState({ total: 0, pageCount: 0 })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    let active = true
    async function loadTickets() {
      setIsRefreshing(true)
      setError('')
      try {
        const params = new URLSearchParams({ view, page: String(page), pageSize: '25' })
        if (debouncedSearch) params.set('search', debouncedSearch)
        const { data } = await authenticatedRequest<{ items: TicketSummary[]; total: number; pageCount: number }>({ method: 'GET', url: `/tickets/me?${params}` })
        if (active) { setTickets(data.items); setPageInfo({ total: data.total, pageCount: data.pageCount }) }
      } catch {
        if (active) setError('Could not load your digital tickets. Please refresh.')
      } finally {
        if (active) setIsRefreshing(false)
      }
    }
    void loadTickets()
    return () => {
      active = false
    }
  }, [authenticatedRequest, isLoaded, isSignedIn, reload, view, page, debouncedSearch])

  useEffect(() => { setPage(1) }, [view, search])

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
        <LinkButton to="/sign-in" state={{ from: { pathname: '/tickets' } }}>
          Sign In
        </LinkButton>
      </div>
    )
  }

  return (
    <main className="mx-auto w-full max-w-[1240px] px-5 pb-20 pt-9 sm:px-6 sm:pt-12" aria-busy={isRefreshing}>
      <PageIntro
        eyebrow="Your Eventora wallet"
        title="My tickets"
        description="Your entry passes, event details, and ticket history in one place. Open a pass when you arrive at the venue."
        actions={<div className="flex flex-wrap gap-2"><LinkButton variant="secondary" to="/account">Orders &amp; account</LinkButton><LinkButton to="/discover"><IconSearch style={{ width: '15px', height: '15px' }} /> Find an event</LinkButton></div>}
      />
      <section className="mb-5 flex w-full flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between" aria-label="Ticket filters">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Ticket wallet views">{([['UPCOMING', 'Upcoming'], ['PAST', 'Past'], ['CANCELLED', 'Cancelled'], ['ALL', 'All tickets']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={view === value} onClick={() => { setView(value); setPage(1) }} className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${view === value ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{label}</button>)}</div>
        <label className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-slate-300 px-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 sm:max-w-[320px]"><IconSearch className="h-4 w-4 shrink-0 text-slate-400" /><input className="w-full border-0 bg-transparent text-sm outline-none" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search event name" aria-label="Search tickets by event" /></label>
      </section>
      {tickets && <div className="mb-3 flex min-h-5 items-center justify-between text-sm text-slate-500" aria-live="polite"><span>{isRefreshing ? 'Updating tickets…' : `${pageInfo.total} ${pageInfo.total === 1 ? 'ticket' : 'tickets'}`}</span>{search && <button type="button" onClick={() => setSearch('')} className="font-semibold text-indigo-700 hover:underline">Clear search</button>}</div>}

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
        <div className="mx-auto mb-8 max-w-2xl rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm sm:px-10">
          <IconTicket style={{ width: '48px', height: '48px', color: 'var(--text-muted)', margin: '0 auto 16px' }} />
          <h3 className="mb-2 mt-0 text-xl font-bold text-slate-900">{search ? 'No matching tickets' : view === 'UPCOMING' ? 'No upcoming tickets yet' : view === 'PAST' ? 'No past tickets' : view === 'CANCELLED' ? 'No cancelled-event tickets' : 'No tickets yet'}</h3>
          <p className="mx-auto mb-6 max-w-md text-sm leading-6 text-slate-600">
            {search ? 'Try a different event name or clear the search to see your tickets.' : view === 'UPCOMING' || view === 'ALL' ? 'When you book an event, your confirmed entry pass will appear here.' : 'Tickets for this view will appear here when you have matching bookings.'}
          </p>
          {search || view !== 'UPCOMING' ? <button type="button" onClick={() => { setSearch(''); setView('UPCOMING'); setPage(1) }} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Reset filters</button> : <LinkButton to="/discover">Explore upcoming events</LinkButton>}
        </div>
      )}

      {tickets && tickets.length > 0 && (
        <div className={`grid grid-cols-1 gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3 ${isRefreshing ? 'opacity-60' : 'opacity-100'}`}>
          {tickets.map((t) => {
            const passState = ticketState(t)
            const qrUnavailable = !canOpenQr(t)
            const qrUnavailableLabel = t.event.status === 'CANCELLED' ? 'Event cancelled' : t.status === 'VOIDED' ? 'Ticket voided' : t.status === 'CHECKED_IN' ? 'Already used' : 'QR expired'
            return <article className="relative flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)] before:absolute after:absolute before:top-[130px] after:top-[130px] before:left-[-10px] after:right-[-10px] before:z-[2] after:z-[2] before:h-5 after:h-5 before:w-5 after:w-5 before:rounded-full after:rounded-full before:bg-[var(--surface-alt)] after:bg-[var(--surface-alt)] before:content-[''] after:content-['']" key={t.id}>
              <div className="relative h-[140px] overflow-hidden bg-slate-900">
                <img
                  className="h-full w-full object-cover"
                  src={t.event.coverImageUrl || getEventPlaceholder(t.event.title)}
                  alt={t.event.title}
                />
              </div>

              <div className="flex flex-col gap-3 p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none capitalize border border-[#c7d2fe] bg-[#eef2ff] text-[#4f46e5] [--badge-dot-color:#6366f1]">{t.ticketType.name}</span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${passState.tone}`}>{passState.label}</span>
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
                  {t.event.status === 'CANCELLED' && t.event.cancellationReason && <span className="mt-1 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-800">Cancellation note: {t.event.cancellationReason}</span>}
                </div>

                <div
                  className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-slate-200 pt-4"
                >
                  <code style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                    {t.reference}
                  </code>
                  <div className="flex flex-wrap items-center gap-3">
                  <Link to={`/events/${t.event.slug}`} className="text-xs font-semibold text-indigo-700 hover:underline">Event details</Link>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px] [--button-px:12px] [--button-py:6px] [--button-font-size:13px] [--button-radius:var(--radius-sm)] text-[13px]"
                    onClick={() => void openTicket(t)}
                    disabled={loadingModal || qrUnavailable}
                  >
                    <IconQrCode /> {qrUnavailable ? qrUnavailableLabel : 'View QR pass'}
                  </button>
                  </div>
                </div>
              </div>
            </article>
          })}
        </div>
      )}
      {tickets && pageInfo.pageCount > 1 && <div className="mx-auto mt-6 flex max-w-[900px] flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"><span>{pageInfo.total} passes · Page {page} of {pageInfo.pageCount}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="min-h-10 rounded border px-3 py-1.5 disabled:opacity-40">Previous</button><button disabled={page >= pageInfo.pageCount} onClick={() => setPage((value) => value + 1)} className="min-h-10 rounded border px-3 py-1.5 disabled:opacity-40">Next</button></div></div>}

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
                padding: 'clamp(12px, 5vw, 24px)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                display: 'inline-block',
                boxShadow: 'var(--shadow-md)',
                marginBottom: '20px',
              }}
            >
              {canOpenQr(selected) ? <img
                src={selected.qrCode}
                alt={`Entry code for ${selected.reference}`}
                className="block h-auto w-[min(220px,60vw)]"
              /> : <p className="m-0 max-w-[240px] text-sm leading-6 text-slate-600">{selected.event.status === 'CANCELLED' ? 'This event was cancelled, so the QR pass is no longer available.' : selected.status === 'CHECKED_IN' ? 'This ticket has already been used for entry.' : 'This event has ended, so the QR pass is no longer valid.'}</p>}
            </div>

            <div className="text-muted" style={{ fontSize: '13px', lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 6px' }}>
                <strong>{selected.event.venue}, {selected.event.city}</strong>
              </p>
              <p style={{ margin: '0 0 16px' }}>
                {formatEventDate(selected.event.startAt, selected.event.timezone)}
              </p>
              <div
                className={`flex items-center justify-center gap-2 text-xs font-semibold ${selected.status === 'CHECKED_IN' ? 'text-slate-600' : selected.status === 'VOIDED' || selected.event.status === 'CANCELLED' ? 'text-rose-700' : 'text-emerald-700'}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <IconShield style={{ width: '14px', height: '14px' }} />
                {selected.status === 'CHECKED_IN' ? 'This ticket has already been checked in.' : selected.status === 'VOIDED' ? 'This ticket is no longer valid for entry.' : selected.event.status === 'CANCELLED' ? 'This event was cancelled; keep this with your booking history.' : new Date(selected.event.endAt) < new Date() ? 'This event has ended; keep this with your booking history.' : 'Have this QR ready when you arrive at the venue.'}
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

function ticketState(ticket: TicketSummary) {
  if (ticket.event.status === 'CANCELLED') return { label: 'Event cancelled', tone: 'bg-rose-50 text-rose-700' }
  if (ticket.status === 'VOIDED') return { label: 'Ticket voided', tone: 'bg-rose-50 text-rose-700' }
  if (ticket.status === 'CHECKED_IN') return { label: 'Already checked in', tone: 'bg-slate-100 text-slate-700' }
  const now = Date.now()
  if (new Date(ticket.event.endAt).getTime() < now) return { label: 'Past event', tone: 'bg-slate-100 text-slate-700' }
  if (new Date(ticket.event.startAt).getTime() <= now) return { label: 'Event in progress', tone: 'bg-emerald-50 text-emerald-700' }
  return { label: 'Ready for entry', tone: 'bg-emerald-50 text-emerald-700' }
}

function canOpenQr(ticket: TicketSummary) {
  return ticket.status === 'ISSUED'
    && ticket.event.status === 'PUBLISHED'
    && new Date(ticket.event.endAt).getTime() > Date.now()
}
