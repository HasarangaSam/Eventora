import { useAuth, useUser } from '@clerk/react'
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { useAuthenticatedApi } from './use-authenticated-api'
import { useCurrentUser } from './current-user-context'
import { OrganizerApplicationPanel } from '../organizer/organizer-application-panel'
import type { PublicEventCard } from '../events/event-card'
import { EventGrid } from '../events/event-grid'
import { formatEventDate } from '../events/event-format'
import { getEventPlaceholder } from '../../lib/placeholders'
import { Modal } from '../../components/ui/modal'
import { LinkButton } from '../../components/ui/link-button'
import { api } from '../../lib/api'
import {
  IconCalendar,
  IconCheckCircle,
  IconCreditCard,
  IconMapPin,
  IconQrCode,
  IconSearch,
  IconShield,
  IconTicket,
  IconUsers,
} from '../../components/ui/icons'

interface CurrentUser {
  email: string
  firstName: string | null
  lastName: string | null
  role: 'ATTENDEE' | 'ORGANIZER' | 'ADMIN'
  status: 'ACTIVE' | 'DEACTIVATED'
}

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

interface AttendeeDashboardData {
  activeTickets: number
  registrationCount: number
  registrations: Array<{
    id: string
    status: string
    createdAt: string
    event: {
      id: string
      slug: string
      title: string
      startAt: string
      city: string
    }
  }>
}

interface RegistrationHistoryItem {
  id: string; status: string; quantity: number; unitPrice: string; totalAmount: string; currency: string; createdAt: string
  event: { id: string; slug: string; title: string; startAt: string; endAt: string; city: string; status: string; cancellationReason: string | null }
  ticketType: { id: string; name: string }
  payment: { id: string; status: string; amount: string; currency: string } | null
}

interface EventPage {
  items: PublicEventCard[]
}

export function AccountPage() {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const { user: clerkUser } = useUser()
  const authenticatedRequest = useAuthenticatedApi()
  const { user: cachedUser, role } = useCurrentUser()

  const [user, setUser] = useState<CurrentUser | null>(cachedUser)
  const [loading, setLoading] = useState(!cachedUser)
  const [error, setError] = useState('')

  // Attendee Data
  const [dashboardData, setDashboardData] = useState<AttendeeDashboardData | null>(null)
  const [tickets, setTickets] = useState<TicketSummary[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(true)
  const [ticketsError, setTicketsError] = useState(false)
  const [dashboardRetry, setDashboardRetry] = useState(0)
  const [orderHistory, setOrderHistory] = useState<RegistrationHistoryItem[]>([])
  const [orderSearch, setOrderSearch] = useState('')
  const [orderStatus, setOrderStatus] = useState('')
  const [orderPage, setOrderPage] = useState(1)
  const [orderPageInfo, setOrderPageInfo] = useState({ total: 0, pageCount: 0 })
  const [recommendedEvents, setRecommendedEvents] = useState<PublicEventCard[]>([])
  const [activeTab, setActiveTab] = useState<'passes' | 'orders' | 'organizer' | 'profile'>('passes')

  // QR Modal
  const [selectedTicket, setSelectedTicket] = useState<TicketDetails | null>(null)
  const [loadingQr, setLoadingQr] = useState(false)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return
    let active = true

    async function loadUser(): Promise<boolean> {
      try {
        const { data } = await authenticatedRequest<CurrentUser>({ method: 'GET', url: '/auth/me' })
        if (active) setUser(data)
        return true
      } catch {
        if (active) setError('Could not load account details.')
        return false
      } finally {
        if (active) setLoading(false)
      }
    }

    async function loadDashboard() {
      try {
        const { data } = await authenticatedRequest<AttendeeDashboardData>({ method: 'GET', url: '/attendee/dashboard' })
        if (active) setDashboardData(data)
      } catch {
        // The dashboard summary is optional; ticket and profile data can still render.
      }
    }

    async function loadTickets() {
      if (active) { setTicketsLoading(true); setTicketsError(false) }
      try {
        const { data } = await authenticatedRequest<{ items: TicketSummary[] }>({ method: 'GET', url: '/tickets/me?view=UPCOMING&pageSize=100' })
        if (active) setTickets(data.items)
      } catch {
        if (active) setTicketsError(true)
      } finally {
        if (active) setTicketsLoading(false)
      }
    }

    async function loadRecommendations() {
      try {
        const { data } = await api.get<EventPage>('/events?sort=newest&direction=desc&page=1&pageSize=3')
        if (active) setRecommendedEvents(data.items)
      } catch {
        // Recommendations are supplementary to the account dashboard.
      }
    }

    void Promise.all([loadUser(), loadRecommendations()]).then(async ([accountLoaded]) => {
      if (!active || !accountLoaded) return
      await Promise.all([loadDashboard(), loadTickets()])
    })

    return () => {
      active = false
    }
  }, [authenticatedRequest, dashboardRetry, isLoaded, isSignedIn, userId])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    let active = true
    const params = new URLSearchParams({ page: String(orderPage), pageSize: '10' })
    if (orderSearch.trim()) params.set('search', orderSearch.trim())
    if (orderStatus) params.set('status', orderStatus)
    authenticatedRequest<{ items: RegistrationHistoryItem[]; total: number; pageCount: number }>({ method: 'GET', url: `/registrations/me?${params}` })
      .then(({ data }) => { if (active) { setOrderHistory(data.items); setOrderPageInfo({ total: data.total, pageCount: data.pageCount }) } })
      .catch(() => { if (active) setOrderHistory([]) })
    return () => { active = false }
  }, [authenticatedRequest, isLoaded, isSignedIn, orderPage, orderSearch, orderStatus])

  useEffect(() => { setOrderPage(1) }, [orderSearch, orderStatus])

  const openQrModal = async (ticket: TicketSummary) => {
    setLoadingQr(true)
    try {
      const { data } = await authenticatedRequest<TicketDetails>({
        method: 'GET',
        url: `/tickets/${encodeURIComponent(ticket.id)}`,
      })
      setSelectedTicket(data)
    } catch {
      setError('Could not retrieve QR code.')
    } finally {
      setLoadingQr(false)
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-[var(--text-muted)] font-medium">
        <div className="h-8 w-8 rounded-full border-[3px] border-[rgba(99,102,241,0.2)] border-t-[var(--primary)] animate-[spin_0.8s_linear_infinite]" />
        <p>Loading Eventora…</p>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-[var(--text-muted)] font-medium">
        <IconTicket style={{ width: '48px', height: '48px', color: 'var(--primary)', marginBottom: '12px' }} />
        <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Sign in to View Your Account</h2>
        <p className="text-muted">Access your tickets, registrations, and account settings.</p>
        <Link to="/sign-in" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px]">
          Sign In to Eventora
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-[var(--text-muted)] font-medium">
        <div className="h-8 w-8 rounded-full border-[3px] border-[rgba(99,102,241,0.2)] border-t-[var(--primary)] animate-[spin_0.8s_linear_infinite]" />
        <p>Loading your attendee account…</p>
      </div>
    )
  }

  if (role === 'ADMIN') {
    return <Navigate to="/admin" replace />
  }

  if (role === 'ORGANIZER') {
    return <Navigate to="/organizer" replace />
  }

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
    : clerkUser?.fullName || 'Attendee'

  const userEmail = user?.email || clerkUser?.primaryEmailAddress?.emailAddress || ''
  const avatarUrl = clerkUser?.imageUrl

  const activeTicketCount = dashboardData?.activeTickets ?? tickets.filter((ticket) => ticket.status === 'ISSUED').length
  const totalBookingsCount = dashboardData?.registrationCount ?? dashboardData?.registrations?.length ?? 0
  const registrationsList = orderHistory

  return (
    <main className="mx-auto w-full max-w-[1280px] px-6 pb-20 pt-8">
      <section className="mb-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-5 px-6 py-6 sm:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-indigo-100 bg-indigo-600 shadow-sm">
              {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xl font-extrabold text-white">{displayName.charAt(0).toUpperCase()}</div>}
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-indigo-700">Your Eventora account</p>
              <h1 className="m-0 truncate text-2xl font-extrabold tracking-tight text-slate-900">Welcome back, {displayName}</h1>
              <p className="mb-0 mt-1 truncate text-sm text-slate-500">{userEmail} · Your bookings and entry passes in one place.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton variant="secondary" size="small" to="/discover"><IconSearch style={{ width: '15px', height: '15px' }} /> Browse events</LinkButton>
            <LinkButton size="small" to="/tickets"><IconTicket style={{ width: '15px', height: '15px' }} /> Open my tickets</LinkButton>
          </div>
        </div>
        <div className="grid gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-2">
          <div className="flex items-center gap-3 bg-slate-50 px-6 py-4 sm:px-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><IconTicket style={{ width: '18px', height: '18px' }} /></span>
            <div><span className="block text-xs font-semibold text-slate-500">Upcoming passes</span><strong className="text-lg font-extrabold text-slate-900">{activeTicketCount}</strong></div>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 px-6 py-4 sm:px-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><IconCreditCard style={{ width: '18px', height: '18px' }} /></span>
            <div><span className="block text-xs font-semibold text-slate-500">All bookings</span><strong className="text-lg font-extrabold text-slate-900">{totalBookingsCount}</strong></div>
          </div>
        </div>
      </section>

      {error && (
        <div className="my-5 flex w-full items-start gap-3 rounded-[var(--radius-md)] border-l-4 border-l-[var(--danger)] bg-white px-[18px] py-3.5 shadow-[0_10px_25px_-5px_rgba(15,23,42,0.2),0_8px_10px_-6px_rgba(15,23,42,0.1)]">
          <div className="flex-1">{error}</div>
        </div>
      )}

      {/* ── 2. DASHBOARD TABS ── */}
      <nav className="flex gap-2 border-b-[1.5px] border-slate-200 mb-7 overflow-x-auto" aria-label="Attendee Dashboard Tabs">
        <button
          type="button"
          onClick={() => setActiveTab('passes')}
          className={`inline-flex items-center gap-2 py-3 px-5 text-sm font-bold text-slate-500 bg-transparent border-0 border-b-[2.5px] border-transparent -mb-0.5 cursor-pointer transition-all duration-150 whitespace-nowrap hover:text-slate-900 ${activeTab === 'passes' ? 'text-indigo-600 border-b-[#4f46e5]' : ''}`}
        >
          <IconTicket style={{ width: '16px', height: '16px' }} />
          <span>My Passes ({tickets.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`inline-flex items-center gap-2 py-3 px-5 text-sm font-bold text-slate-500 bg-transparent border-0 border-b-[2.5px] border-transparent -mb-0.5 cursor-pointer transition-all duration-150 whitespace-nowrap hover:text-slate-900 ${activeTab === 'orders' ? 'text-indigo-600 border-b-[#4f46e5]' : ''}`}
        >
          <IconCreditCard style={{ width: '16px', height: '16px' }} />
          <span>Order History ({orderPageInfo.total})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('organizer')}
          className={`inline-flex items-center gap-2 py-3 px-5 text-sm font-bold text-slate-500 bg-transparent border-0 border-b-[2.5px] border-transparent -mb-0.5 cursor-pointer transition-all duration-150 whitespace-nowrap hover:text-slate-900 ${activeTab === 'organizer' ? 'text-indigo-600 border-b-[#4f46e5]' : ''}`}
        >
          <IconShield style={{ width: '16px', height: '16px' }} />
          <span>Host an Event</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`inline-flex items-center gap-2 py-3 px-5 text-sm font-bold text-slate-500 bg-transparent border-0 border-b-[2.5px] border-transparent -mb-0.5 cursor-pointer transition-all duration-150 whitespace-nowrap hover:text-slate-900 ${activeTab === 'profile' ? 'text-indigo-600 border-b-[#4f46e5]' : ''}`}
        >
          <IconUsers style={{ width: '16px', height: '16px' }} />
          <span>Profile &amp; Security</span>
        </button>
      </nav>

      {/* ── 3. TAB CONTENT ── */}
      <div className="attendee-tab-content">
        {/* TAB 1: PASSES & TICKETS */}
        {activeTab === 'passes' && (
          <div className="attendee-passes-section">
            <div className="flex justify-between items-end mb-6 gap-4 max-[768px]:flex-col max-[768px]:items-start">
              <div>
                <h2 className="mt-0 mx-0 mb-1 text-xl font-extrabold text-slate-900">Your Digital Entry Passes</h2>
                <p className="m-0 text-sm text-slate-500">
                  Show your QR pass at the venue entrance. Staff will scan it to confirm your ticket and check you in.
                </p>
              </div>
              <Link to="/tickets" className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border-0 bg-transparent px-2 py-1 text-[13px] font-semibold text-[var(--text-button-color,var(--primary))] cursor-pointer transition-[all] duration-150 hover:bg-[var(--text-button-bg,var(--primary-light))] hover:text-[var(--text-button-hover,var(--primary-hover))]" style={{ fontSize: '14px', fontWeight: 600 }}>
                Open Dedicated Wallet →
              </Link>
            </div>

            {tickets.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {tickets.map((t) => {
                  const cover = t.event.coverImageUrl || getEventPlaceholder(t.event.title)
                  const qrUnavailable = t.event.status !== 'PUBLISHED' || t.status !== 'ISSUED' || new Date(t.event.endAt) <= new Date()
                  const passLabel = t.event.status === 'CANCELLED' ? 'Event cancelled' : t.event.status === 'COMPLETED' || new Date(t.event.endAt) <= new Date() ? 'Past event' : t.status === 'CHECKED_IN' ? 'Already checked in' : t.status === 'VOIDED' ? 'Ticket voided' : new Date(t.event.startAt) <= new Date() ? 'Event in progress' : 'Ready for entry'
                  return (
                    <article key={t.id} className="bg-white border border-slate-200 rounded-[16px] overflow-hidden shadow-[0_2px_8px_rgba(0,_0,_0,_0.04)] [transition:all_0.2s_ease] flex flex-col hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(15,_23,_42,_0.08)] hover:border-slate-300">
                      <div className="relative h-[160px] overflow-hidden [&_img]:w-full [&_img]:h-full [&_img]:object-cover">
                        <img src={cover} alt={t.event.title} />
                        <span className="absolute top-[12px] left-[12px] bg-slate-900 text-white text-[11px] font-extrabold py-1 px-2.5 rounded-[6px] tracking-[0.5px]">{t.ticketType.name}</span>
                      </div>

                      <div className="p-5 flex flex-col gap-3 [flex:1]">
                        <div className="flex justify-between items-center">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none ${qrUnavailable ? 'border border-rose-200 bg-rose-50 text-rose-700' : t.status === 'CHECKED_IN' || passLabel === 'Past event' ? 'border border-slate-200 bg-slate-100 text-slate-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                            <span className="h-[6px] w-[6px] rounded-full bg-current" /> {passLabel}
                          </span>
                          <span className="[font-family:monospace] text-xs font-bold text-slate-500">{t.reference}</span>
                        </div>

                        <h3 className="m-0 text-[17px] font-extrabold text-slate-900 leading-[1.3]">{t.event.title}</h3>

                        <div className="flex flex-col gap-1.5 text-[13px] text-slate-500">
                          <span className="flex items-center gap-1.5">
                            <IconCalendar style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                            {formatEventDate(t.event.startAt, t.event.timezone)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <IconMapPin style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                            {t.event.venue}, {t.event.city}
                          </span>
                        </div>

                        <div className="pt-3.5 border-t border-dashed border-slate-200 flex justify-end mt-auto">
                          <button
                            type="button"
                            onClick={() => void openQrModal(t)}
                            disabled={loadingQr || qrUnavailable}
                            className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px] [--button-px:12px] [--button-py:6px] [--button-font-size:13px] [--button-radius:var(--radius-sm)] text-[13px] inline-flex items-center gap-1.5 font-bold"
                          >
                            <IconQrCode style={{ width: '16px', height: '16px' }} />
                            {qrUnavailable ? 'QR unavailable' : 'Show QR pass'}
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              ticketsLoading ? <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-600" role="status">Loading your upcoming passes…</div> : ticketsError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-8 text-center" role="alert"><h3 className="m-0 text-base font-bold text-rose-900">Your passes couldn’t be loaded</h3><p className="mb-4 mt-2 text-sm text-rose-800">Your bookings are safe. Try loading the ticket wallet again.</p><button type="button" onClick={() => setDashboardRetry((value) => value + 1)} className="rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100">Try again</button></div> : <div className="text-center py-12 px-6 bg-white border border-slate-200 rounded-[16px]">
                <div className="w-16 h-16 rounded-[50%] bg-slate-100 flex items-center justify-center mt-0 mx-auto mb-4">
                  <IconTicket style={{ width: '36px', height: '36px', color: '#64748b' }} />
                </div>
                <h3 className="mt-0 mx-0 mb-2 text-xl font-extrabold text-slate-900">No Active Event Passes</h3>
                <p className="mt-0 mx-auto mb-4 text-sm text-slate-500 max-w-[480px] leading-[1.6]">
                  You haven't booked any events yet. Once you reserve tickets, your digital QR passes will appear here ready for door admission.
                </p>
                <Link to="/discover" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px]" style={{ marginTop: '8px' }}>
                  Explore Events Happening Soon
                </Link>

                {/* Recommended events right below empty state */}
                {recommendedEvents.length > 0 && (
                  <div className="mt-12 text-left border-t border-slate-200 pt-9">
                    <h4 className="mt-0 mx-0 mb-5 text-lg font-extrabold text-slate-900">Trending Events You Might Like</h4>
                    <EventGrid events={recommendedEvents} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ORDER & REGISTRATION HISTORY */}
        {activeTab === 'orders' && (
          <div className="attendee-orders-section">
            <div className="flex flex-wrap justify-between items-end mb-6 gap-4">
              <div>
                <h2 className="mt-0 mx-0 mb-1 text-xl font-extrabold text-slate-900">Order &amp; Booking History</h2>
                <p className="m-0 text-sm text-slate-500">{orderPageInfo.total} bookings · includes payment and event status.</p>
              </div>
              <div className="flex flex-wrap gap-2"><input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="search" value={orderSearch} onChange={(e) => { setOrderSearch(e.target.value); setOrderPage(1) }} placeholder="Search event or ticket type" aria-label="Search booking history" /><select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={orderStatus} onChange={(e) => { setOrderStatus(e.target.value); setOrderPage(1) }} aria-label="Filter bookings by status"><option value="">All booking statuses</option><option value="PENDING">Pending</option><option value="CONFIRMED">Confirmed</option><option value="EXPIRED">Expired</option></select></div>
            </div>

            {registrationsList.length > 0 ? (
              <div className="overflow-x-auto rounded-[14px] border border-slate-200 bg-white">
                <table className="w-full min-w-[760px] [border-collapse:collapse] [&_th]:bg-slate-50 [&_th]:py-3.5 [&_th]:px-5 [&_th]:text-left [&_th]:text-xs [&_th]:font-bold [&_th]:text-slate-500 [&_th]:uppercase [&_th]:tracking-[0.5px] [&_th]:border-b [&_th]:border-slate-200 [&_td]:py-4 [&_td]:px-5 [&_td]:border-b [&_td]:border-slate-100 [&_td]:text-sm [&_tr:last-child_td]:border-b-0">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Ticket</th>
                      <th>Amount</th>
                      <th>Booking / Payment</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrationsList.map((reg) => (
                      <tr key={reg.id}>
                        <td>
                          <strong className="block text-slate-900 text-[15px]">{reg.event?.title || 'Event'}</strong>
                          <span className="text-xs text-slate-500">{reg.event?.city} · {new Date(reg.event.startAt).toLocaleString()}</span>
                          {reg.event.status === 'CANCELLED' && <span className="mt-1 block text-xs font-semibold text-rose-700">Cancelled{reg.event.cancellationReason ? ` · ${reg.event.cancellationReason}` : ''}</span>}
                        </td>
                        <td>{reg.ticketType.name} × {reg.quantity}<span className="mt-1 block text-xs text-slate-500">Booked {new Date(reg.createdAt).toLocaleDateString()}</span></td>
                        <td className="font-semibold">{reg.currency} {Number(reg.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${reg.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700' : reg.status === 'EXPIRED' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'}`}>{reg.status.toLowerCase()}</span><span className="mt-1 block text-xs text-slate-500">Payment: {reg.payment?.status?.toLowerCase() ?? 'not started'}</span></td>
                        <td>
                          {reg.status === 'CONFIRMED' && reg.event.status === 'PUBLISHED' && new Date(reg.event.endAt) > new Date() ? <Link to="/tickets" className="text-sm font-semibold text-indigo-700 hover:underline">View pass →</Link> : <Link to={`/events/${reg.event.slug}`} className="text-sm font-semibold text-indigo-700 hover:underline">Event details →</Link>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-[14px] p-10 text-center">
                <p className="text-muted">No bookings match this search and filter.</p>
                <Link to="/discover" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)] [--button-px:12px] [--button-py:6px] [--button-font-size:13px] [--button-radius:var(--radius-sm)] text-[13px]">
                  Browse Events Directory
                </Link>
              </div>
            )}
            {orderPageInfo.pageCount > 1 && <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"><span>Page {orderPage} of {orderPageInfo.pageCount}</span><div className="flex gap-2"><button disabled={orderPage <= 1} onClick={() => setOrderPage((value) => value - 1)} className="rounded border px-3 py-1.5 disabled:opacity-40">Previous</button><button disabled={orderPage >= orderPageInfo.pageCount} onClick={() => setOrderPage((value) => value + 1)} className="rounded border px-3 py-1.5 disabled:opacity-40">Next</button></div></div>}
          </div>
        )}

        {/* TAB 3: HOST EVENTS / ORGANIZER APPLICATION */}
        {activeTab === 'organizer' && (
          <div className="attendee-organizer-section">
            <div className="flex justify-between items-end mb-6 gap-4 max-[768px]:flex-col max-[768px]:items-start">
              <div>
                <h2 className="mt-0 mx-0 mb-1 text-xl font-extrabold text-slate-900">Host &amp; Sell Events on Eventora</h2>
                <p className="m-0 text-sm text-slate-500">
                  Apply for verified organizer accreditation to publish events, manage ticket tiers, and use our door scanner console.
                </p>
              </div>
            </div>

            {user && (
              <OrganizerApplicationPanel
                role="ATTENDEE"
                firstName={user.firstName}
                lastName={user.lastName}
                email={user.email}
              />
            )}
          </div>
        )}

        {/* TAB 4: PROFILE & SECURITY */}
        {activeTab === 'profile' && (
          <div className="attendee-profile-section">
            <div className="flex justify-between items-end mb-6 gap-4 max-[768px]:flex-col max-[768px]:items-start">
              <div>
                <h2 className="mt-0 mx-0 mb-1 text-xl font-extrabold text-slate-900">Profile &amp; Security Settings</h2>
                <p className="m-0 text-sm text-slate-500">
                  Manage your personal details, email authentication, and security preferences.
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-[16px] p-8 flex flex-col gap-[18px] max-w-[680px]">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <span className="text-[13px] font-semibold text-slate-500">Full Name</span>
                <strong className="text-sm font-bold text-slate-900">{displayName}</strong>
              </div>

              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <span className="text-[13px] font-semibold text-slate-500">Primary Email</span>
                <strong className="text-sm font-bold text-slate-900">{userEmail}</strong>
              </div>

              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <span className="text-[13px] font-semibold text-slate-500">Account Role</span>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none capitalize border border-[#c7d2fe] bg-[#eef2ff] text-[#4f46e5] [--badge-dot-color:#6366f1]">ATTENDEE (Standard Access)</span>
              </div>

              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <span className="text-[13px] font-semibold text-slate-500">Sign-in method</span>
                <span className="text-sm font-bold text-slate-900">Secure sign-in with Google or email</span>
              </div>

              <div className="flex items-center gap-2.5 text-[13px] text-emerald-600 bg-emerald-50 border border-emerald-200 py-3 px-4 rounded-[10px]">
                <IconShield style={{ width: '16px', height: '16px', color: '#10b981', flexShrink: 0 }} />
                <span>Your sign-in and account sessions are protected.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. QR CODE MODAL ── */}
      {selectedTicket && (
        <Modal
          isOpen={Boolean(selectedTicket)}
          title="Digital Entry Pass"
          onClose={() => setSelectedTicket(null)}
        >
          <div className="text-center py-2 px-0">
            <div className="attendee-qr-modal-top">
              <span className="inline-block bg-slate-900 text-white text-[11px] font-extrabold py-1 px-2.5 rounded-[6px] tracking-[0.5px] mb-2">{selectedTicket.ticketType.name}</span>
              <h3 className="mt-0 mx-0 mb-1.5 text-xl font-extrabold text-slate-900">{selectedTicket.event.title}</h3>
              <p className="m-0 text-[13px] font-semibold text-indigo-600">
                {formatEventDate(selectedTicket.event.startAt, selectedTicket.event.timezone)}
              </p>
              <p className="mt-1 mx-0 mb-0 text-[13px] text-slate-500">
                {selectedTicket.event.venue}, {selectedTicket.event.city}
              </p>
            </div>

            <div className="my-[18px] mx-0 border-t-[2px] border-dashed border-slate-200">
              <div className="attendee-modal-notch-left" />
              <div className="attendee-modal-dash" />
              <div className="attendee-modal-notch-right" />
            </div>

            <div className="bg-white border-[2px] border-slate-900 rounded-[16px] p-5 flex flex-col items-center gap-2.5 max-w-[260px] mt-0 mx-auto mb-4 shadow-[0_4px_14px_rgba(15,_23,_42,_0.08)]">
              {selectedTicket.qrCode && selectedTicket.status === 'ISSUED' && selectedTicket.event.status === 'PUBLISHED' && new Date(selectedTicket.event.endAt) > new Date() ? (
                <img
                  src={selectedTicket.qrCode}
                  alt={`QR Code for ${selectedTicket.reference}`}
                  className="w-[180px] h-[180px] object-contain"
                />
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444' }}>
                  QR code unavailable
                </div>
              )}
              <code className="[font-family:monospace] text-sm font-extrabold text-slate-900 tracking-[1px]">{selectedTicket.reference}</code>
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.5px]">Present this code to event staff</span>
            </div>

            <div className={`flex items-center justify-center gap-2 text-xs font-semibold ${selectedTicket.status === 'CHECKED_IN' ? 'text-slate-600' : selectedTicket.event.status === 'CANCELLED' || selectedTicket.status === 'VOIDED' ? 'text-rose-700' : 'text-emerald-700'}`}>
              <IconCheckCircle style={{ width: '15px', height: '15px' }} />
              <span>{selectedTicket.status === 'CHECKED_IN' ? 'This ticket has already been checked in.' : selectedTicket.event.status === 'CANCELLED' ? 'This event was cancelled. Keep this pass with your booking history.' : selectedTicket.status === 'VOIDED' ? 'This ticket is no longer valid for entry.' : new Date(selectedTicket.event.endAt) < new Date() ? 'This event has ended. Keep this pass with your booking history.' : 'Have this QR code ready when you arrive at the venue.'}</span>
            </div>
          </div>
        </Modal>
      )}
    </main>
  )
}
