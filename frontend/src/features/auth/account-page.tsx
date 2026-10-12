import { useAuth, useUser } from '@clerk/react'
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { useAuthenticatedApi } from './use-authenticated-api'
import { useCurrentUser } from './current-user-context'
import { OrganizerApplicationPanel } from '../organizer/organizer-application-panel'
import { EventCard, type PublicEventCard } from '../events/event-card'
import { formatEventDate } from '../events/event-format'
import { getEventPlaceholder } from '../../lib/placeholders'
import { Modal } from '../../components/ui/modal'
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
  const [recommendedEvents, setRecommendedEvents] = useState<PublicEventCard[]>([])
  const [activeTab, setActiveTab] = useState<'passes' | 'orders' | 'organizer' | 'profile'>('passes')

  // QR Modal
  const [selectedTicket, setSelectedTicket] = useState<TicketDetails | null>(null)
  const [loadingQr, setLoadingQr] = useState(false)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return
    let active = true

    // Fetch user details
    authenticatedRequest<CurrentUser>({ method: 'GET', url: '/auth/me' })
      .then(({ data }) => {
        if (active) setUser(data)
      })
      .catch(() => {
        if (active) setError('Could not load account details.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    // Fetch attendee dashboard metrics & registrations
    authenticatedRequest<AttendeeDashboardData>({ method: 'GET', url: '/attendee/dashboard' })
      .then(({ data }) => {
        if (active) setDashboardData(data)
      })
      .catch(() => {})

    // Fetch attendee's digital tickets
    authenticatedRequest<TicketSummary[]>({ method: 'GET', url: '/tickets/me' })
      .then(({ data }) => {
        if (active) setTickets(data)
      })
      .catch(() => {})

    // Fetch curated events as recommendations
    api
      .get<EventPage>('/events?sort=newest&direction=desc&page=1&pageSize=3')
      .then(({ data }) => {
        if (active) setRecommendedEvents(data.items)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [authenticatedRequest, isLoaded, isSignedIn, userId])

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
      <div className="fullscreen-loading">
        <div className="spinner" />
        <p>Loading Eventora…</p>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="fullscreen-loading">
        <IconTicket style={{ width: '48px', height: '48px', color: 'var(--primary)', marginBottom: '12px' }} />
        <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Sign in to View Your Account</h2>
        <p className="text-muted">Access your tickets, registrations, and account settings.</p>
        <Link to="/sign-in" className="btn btn-primary">
          Sign In to Eventora
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="fullscreen-loading">
        <div className="spinner" />
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

  const activeTicketCount = dashboardData?.activeTickets ?? tickets.length
  const totalBookingsCount = dashboardData?.registrationCount ?? dashboardData?.registrations?.length ?? 0
  const registrationsList = dashboardData?.registrations ?? []

  return (
    <main className="public-container attendee-dashboard">
      {/* ── 1. ATTENDEE PROFILE HERO CARD ── */}
      <section className="attendee-hero-card">
        <div className="attendee-hero-top">
          <div className="attendee-profile-info">
            <div className="attendee-avatar-wrapper">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="attendee-avatar-img" />
              ) : (
                <div className="attendee-avatar-placeholder">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="attendee-meta">
              <div className="attendee-name-row">
                <h1 className="attendee-name">{displayName}</h1>
                <span className="attendee-badge">
                  <IconCheckCircle style={{ width: '13px', height: '13px', color: '#10b981' }} />
                  Verified Attendee
                </span>
              </div>
              <p className="attendee-email">{userEmail}</p>
            </div>
          </div>

          <div className="attendee-hero-actions">
            <Link to="/discover" className="btn btn-secondary btn-sm">
              <IconSearch style={{ width: '15px', height: '15px' }} /> Discover Events
            </Link>
            <Link to="/tickets" className="btn btn-primary btn-sm">
              <IconTicket style={{ width: '15px', height: '15px' }} /> Digital Wallet
            </Link>
          </div>
        </div>

        {/* Quick Metric Pills */}
        <div className="attendee-stats-strip">
          <div className="attendee-stat-card">
            <div className="attendee-stat-icon">
              <IconTicket style={{ width: '18px', height: '18px' }} />
            </div>
            <div>
              <span className="attendee-stat-label">Active Passes</span>
              <strong className="attendee-stat-num">{activeTicketCount}</strong>
            </div>
          </div>

          <div className="attendee-stat-card">
            <div className="attendee-stat-icon">
              <IconUsers style={{ width: '18px', height: '18px' }} />
            </div>
            <div>
              <span className="attendee-stat-label">Total Bookings</span>
              <strong className="attendee-stat-num">{totalBookingsCount}</strong>
            </div>
          </div>

          <div className="attendee-stat-card">
            <div className="attendee-stat-icon">
              <IconCreditCard style={{ width: '18px', height: '18px' }} />
            </div>
            <div>
              <span className="attendee-stat-label">Payment Security</span>
              <strong className="attendee-stat-num">PayHere LKR Protected</strong>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="toast-card toast-card--error" style={{ margin: '20px 0', width: '100%' }}>
          <div className="toast-card__content">{error}</div>
        </div>
      )}

      {/* ── 2. DASHBOARD TABS ── */}
      <nav className="attendee-tab-bar" aria-label="Attendee Dashboard Tabs">
        <button
          type="button"
          onClick={() => setActiveTab('passes')}
          className={`attendee-tab-btn ${activeTab === 'passes' ? 'attendee-tab-btn-active' : ''}`}
        >
          <IconTicket style={{ width: '16px', height: '16px' }} />
          <span>My Passes ({tickets.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`attendee-tab-btn ${activeTab === 'orders' ? 'attendee-tab-btn-active' : ''}`}
        >
          <IconCreditCard style={{ width: '16px', height: '16px' }} />
          <span>Order History ({registrationsList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('organizer')}
          className={`attendee-tab-btn ${activeTab === 'organizer' ? 'attendee-tab-btn-active' : ''}`}
        >
          <IconShield style={{ width: '16px', height: '16px' }} />
          <span>Host an Event</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`attendee-tab-btn ${activeTab === 'profile' ? 'attendee-tab-btn-active' : ''}`}
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
            <div className="attendee-section-title-row">
              <div>
                <h2 className="attendee-content-title">Your Digital Entry Passes</h2>
                <p className="attendee-content-subtitle">
                  Present your scannable QR pass at the venue entrance. Single-use and cryptographically signed.
                </p>
              </div>
              <Link to="/tickets" className="text-button" style={{ fontSize: '14px', fontWeight: 600 }}>
                Open Dedicated Wallet →
              </Link>
            </div>

            {tickets.length > 0 ? (
              <div className="attendee-tickets-grid">
                {tickets.map((t) => {
                  const cover = t.event.coverImageUrl || getEventPlaceholder(t.event.title)
                  return (
                    <article key={t.id} className="attendee-ticket-card">
                      <div className="attendee-ticket-cover">
                        <img src={cover} alt={t.event.title} />
                        <span className="attendee-ticket-tier-badge">{t.ticketType.name}</span>
                      </div>

                      <div className="attendee-ticket-body">
                        <div className="attendee-ticket-status">
                          <span className="badge badge-emerald">
                            <span className="badge-dot" /> Verified Entry Pass
                          </span>
                          <span className="attendee-ticket-ref">{t.reference}</span>
                        </div>

                        <h3 className="attendee-ticket-event-title">{t.event.title}</h3>

                        <div className="attendee-ticket-meta">
                          <span className="attendee-meta-item">
                            <IconCalendar style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                            {formatEventDate(t.event.startAt, t.event.timezone)}
                          </span>
                          <span className="attendee-meta-item">
                            <IconMapPin style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                            {t.event.venue}, {t.event.city}
                          </span>
                        </div>

                        <div className="attendee-ticket-action-bar">
                          <button
                            type="button"
                            onClick={() => void openQrModal(t)}
                            disabled={loadingQr}
                            className="btn btn-primary btn-sm attendee-qr-trigger-btn"
                          >
                            <IconQrCode style={{ width: '16px', height: '16px' }} />
                            Show QR Pass
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="attendee-empty-passes-box">
                <div className="attendee-empty-icon-wrap">
                  <IconTicket style={{ width: '36px', height: '36px', color: '#64748b' }} />
                </div>
                <h3 className="attendee-empty-title">No Active Event Passes</h3>
                <p className="attendee-empty-desc">
                  You haven't booked any events yet. Once you reserve tickets, your digital QR passes will appear here ready for door admission.
                </p>
                <Link to="/discover" className="btn btn-primary" style={{ marginTop: '8px' }}>
                  Explore Events Happening Soon
                </Link>

                {/* Recommended events right below empty state */}
                {recommendedEvents.length > 0 && (
                  <div className="attendee-recommended-block">
                    <h4 className="attendee-recommended-heading">Trending Events You Might Like</h4>
                    <div className="event-grid">
                      {recommendedEvents.map((event) => (
                        <EventCard key={event.id} event={event} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ORDER & REGISTRATION HISTORY */}
        {activeTab === 'orders' && (
          <div className="attendee-orders-section">
            <div className="attendee-section-title-row">
              <div>
                <h2 className="attendee-content-title">Order &amp; Booking History</h2>
                <p className="attendee-content-subtitle">
                  All past registrations and payment records processed securely via PayHere.
                </p>
              </div>
            </div>

            {registrationsList.length > 0 ? (
              <div className="attendee-orders-table-card">
                <table className="attendee-orders-table">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Event Date</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrationsList.map((reg) => (
                      <tr key={reg.id}>
                        <td>
                          <strong className="attendee-order-title">{reg.event?.title || 'Event'}</strong>
                          <span className="attendee-order-city">{reg.event?.city}</span>
                        </td>
                        <td>
                          <span className="attendee-order-date">
                            {reg.event?.startAt ? new Date(reg.event.startAt).toLocaleDateString() : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-emerald">
                            <span className="badge-dot" />
                            {reg.status.toLowerCase()}
                          </span>
                        </td>
                        <td>
                          {reg.event?.slug ? (
                            <Link to={`/events/${reg.event.slug}`} className="text-button" style={{ fontSize: '13px' }}>
                              View Event Details →
                            </Link>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="attendee-empty-orders-box">
                <p className="text-muted">No booking history recorded yet.</p>
                <Link to="/discover" className="btn btn-secondary btn-sm">
                  Browse Events Directory
                </Link>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: HOST EVENTS / ORGANIZER APPLICATION */}
        {activeTab === 'organizer' && (
          <div className="attendee-organizer-section">
            <div className="attendee-section-title-row">
              <div>
                <h2 className="attendee-content-title">Host &amp; Sell Events on Eventora</h2>
                <p className="attendee-content-subtitle">
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
            <div className="attendee-section-title-row">
              <div>
                <h2 className="attendee-content-title">Profile &amp; Security Settings</h2>
                <p className="attendee-content-subtitle">
                  Manage your personal details, email authentication, and security preferences.
                </p>
              </div>
            </div>

            <div className="attendee-profile-card">
              <div className="attendee-profile-field-row">
                <span className="attendee-profile-field-label">Full Name</span>
                <strong className="attendee-profile-field-val">{displayName}</strong>
              </div>

              <div className="attendee-profile-field-row">
                <span className="attendee-profile-field-label">Primary Email</span>
                <strong className="attendee-profile-field-val">{userEmail}</strong>
              </div>

              <div className="attendee-profile-field-row">
                <span className="attendee-profile-field-label">Account Role</span>
                <span className="badge badge-indigo">ATTENDEE (Standard Access)</span>
              </div>

              <div className="attendee-profile-field-row">
                <span className="attendee-profile-field-label">Authentication Provider</span>
                <span className="attendee-profile-field-val">Clerk Secure Identity (Google SSO / Email)</span>
              </div>

              <div className="attendee-profile-footer-tip">
                <IconShield style={{ width: '16px', height: '16px', color: '#10b981', flexShrink: 0 }} />
                <span>Your account is protected with multi-factor authentication and encrypted sessions.</span>
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
          <div className="attendee-qr-modal-content">
            <div className="attendee-qr-modal-top">
              <span className="attendee-modal-tier-badge">{selectedTicket.ticketType.name}</span>
              <h3 className="attendee-modal-event-title">{selectedTicket.event.title}</h3>
              <p className="attendee-modal-event-date">
                {formatEventDate(selectedTicket.event.startAt, selectedTicket.event.timezone)}
              </p>
              <p className="attendee-modal-event-venue">
                {selectedTicket.event.venue}, {selectedTicket.event.city}
              </p>
            </div>

            <div className="attendee-qr-modal-divider">
              <div className="attendee-modal-notch-left" />
              <div className="attendee-modal-dash" />
              <div className="attendee-modal-notch-right" />
            </div>

            <div className="attendee-qr-display-box">
              {selectedTicket.qrCode ? (
                <img
                  src={selectedTicket.qrCode}
                  alt={`QR Code for ${selectedTicket.reference}`}
                  className="attendee-qr-modal-img"
                />
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444' }}>
                  QR code unavailable
                </div>
              )}
              <code className="attendee-qr-modal-ref">{selectedTicket.reference}</code>
              <span className="attendee-qr-modal-scan-hint">Scan with organizer door camera</span>
            </div>

            <div className="attendee-qr-modal-footer">
              <IconCheckCircle style={{ width: '15px', height: '15px', color: '#10b981' }} />
              <span>100% Verified Entry · Single-use door token</span>
            </div>
          </div>
        </Modal>
      )}
    </main>
  )
}
