import { UserButton, useAuth } from '@clerk/react'
import { Link, Route, Routes, useLocation } from 'react-router'
import { AccountPage } from './features/auth/account-page'
import { AdminPage } from './features/admin/admin-page'
import { AdminOverviewPage } from './features/admin/admin-overview-page'
import { AdminApplicationsPage } from './features/admin/admin-applications-page'
import { AdminEventsPage } from './features/admin/admin-events-page'
import { AdminUsersPage } from './features/admin/admin-users-page'
import { AdminCategoriesPage } from './features/admin/admin-categories-page'
import { DiscoveryPage } from './features/events/discovery-page'
import { EventDetailPage } from './features/events/event-detail-page'
import { CheckoutResultPage } from './features/payments/checkout-result-page'
import { TicketsPage } from './features/tickets/tickets-page'
import { EventCheckinPage } from './features/organizer/event-checkin-page'
import { AuthPage } from './features/auth/auth-page'
import { HomePage } from './features/home/home-page'
import { DashboardShell } from './features/analytics/dashboard-shell'
import { OrganizerOverviewPage } from './features/organizer/organizer-overview-page'
import { OrganizerEventsPage, OrganizerSalesPage } from './features/organizer/organizer-pages'
import { OrganizerCheckinHubPage } from './features/organizer/organizer-checkin-hub-page'
import { OrganizerProfilePage } from './features/organizer/organizer-profile-page'
import {
  CurrentUserProvider,
  useCurrentUser,
  PublicRouteGuard,
  AdminRouteGuard,
  OrganizerRouteGuard,
} from './features/auth/current-user-context'
import { ToastProvider } from './components/ui/toast'
import './App.css'

function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link className="brand" to="/">
              eventora<span className="brand-dot">.</span>
            </Link>
            <p className="footer-tagline">
              Discover and host experiences worth leaving home for. Verified ticketing and entry management.
            </p>
          </div>

          <div className="footer-col">
            <h4>Explore</h4>
            <ul className="footer-links">
              <li><Link to="/">Home</Link></li>
              <li><Link to="/discover">Discover Events</Link></li>
              <li><Link to="/tickets">My Ticket Wallet</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Organizers</h4>
            <ul className="footer-links">
              <li><Link to="/account">Organizer Portal</Link></li>
              <li><Link to="/account">Apply for Accreditation</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 Eventora Platform. All rights reserved.</span>
          <a href="#top" style={{ color: 'inherit' }}>Back to top ↑</a>
        </div>
      </div>
    </footer>
  )
}

function PublicHeader() {
  const location = useLocation()
  const { isLoaded, isSignedIn } = useAuth()
  const { role } = useCurrentUser()

  return (
    <header id="top" className="site-header">
      <div className="public-container site-header-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
          <Link className="brand" to="/" aria-label="Eventora home">
            eventora<span className="brand-dot">.</span>
          </Link>

          <nav className="site-nav" aria-label="Main navigation">
            <Link className="nav-link" aria-current={location.pathname === '/' ? 'page' : undefined} to="/">
              Home
            </Link>
            <Link className="nav-link" aria-current={location.pathname === '/discover' ? 'page' : undefined} to="/discover">
              Discover
            </Link>
            {role === 'ATTENDEE' && (
              <Link className="nav-link" to="/tickets">
                My Tickets
              </Link>
            )}
          </nav>
        </div>

        <div className="account-actions">
          {!isLoaded ? (
            <span className="text-muted text-xs">Loading…</span>
          ) : !isSignedIn ? (
            <>
              <Link className="btn btn-ghost btn-sm" to="/sign-in">
                Sign in
              </Link>
              <Link className="btn btn-primary btn-sm" to="/sign-up">
                Sign up
              </Link>
            </>
          ) : (
            <>
              <Link className="btn btn-secondary btn-sm" to="/account">
                Dashboard
              </Link>
              <UserButton />
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function NotFoundPage() {
  return (
    <main className="fullscreen-loading">
      <span className="badge badge-rose">404 Error</span>
      <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Page not found</h1>
      <p className="text-muted">The page you were looking for doesn't exist or has moved.</p>
      <Link className="btn btn-primary" to="/">
        Back to Eventora
      </Link>
    </main>
  )
}

function AppContent() {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
  const location = useLocation()
  const { role } = useCurrentUser()

  // Any admin or organizer dedicated workspace route — no public header/footer
  // Also hide header/footer on auth pages (they have their own full-screen layout)
  const isDedicatedWorkspace =
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/organizer') ||
    location.pathname.startsWith('/sign-in') ||
    location.pathname.startsWith('/sign-up') ||
    (location.pathname === '/account' && (role === 'ORGANIZER' || role === 'ADMIN'))

  return (
    <div className="app-shell">
      {!isDedicatedWorkspace && <PublicHeader />}
      <Routes>
        {/* Public Routes — Admin & Organizer are redirected to their dashboards */}
        <Route
          path="/"
          element={
            <PublicRouteGuard>
              <HomePage />
            </PublicRouteGuard>
          }
        />
        <Route
          path="/discover"
          element={
            <PublicRouteGuard>
              <DiscoveryPage />
            </PublicRouteGuard>
          }
        />
        <Route path="/events/:eventId" element={<EventDetailPage />} />
        <Route path="/checkout/result" element={<CheckoutResultPage />} />
        <Route path="/checkout/cancelled" element={<CheckoutResultPage cancelled />} />
        <Route path="/tickets" element={publishableKey ? <TicketsPage /> : <NotFoundPage />} />

        {/* Auth routes */}
        <Route path="/sign-in/*" element={publishableKey ? <AuthPage mode="sign-in" /> : <NotFoundPage />} />
        <Route path="/sign-up/*" element={publishableKey ? <AuthPage mode="sign-up" /> : <NotFoundPage />} />

        {/* ─── ADMIN DEDICATED UNIT ─── */}
        <Route
          path="/admin"
          element={
            publishableKey ? (
              <AdminRouteGuard>
                <AdminOverviewPage />
              </AdminRouteGuard>
            ) : (
              <NotFoundPage />
            )
          }
        />
        <Route
          path="/admin/applications"
          element={
            publishableKey ? (
              <AdminRouteGuard>
                <AdminApplicationsPage />
              </AdminRouteGuard>
            ) : (
              <NotFoundPage />
            )
          }
        />
        <Route
          path="/admin/events"
          element={
            publishableKey ? (
              <AdminRouteGuard>
                <AdminEventsPage />
              </AdminRouteGuard>
            ) : (
              <NotFoundPage />
            )
          }
        />
        <Route
          path="/admin/users"
          element={
            publishableKey ? (
              <AdminRouteGuard>
                <AdminUsersPage />
              </AdminRouteGuard>
            ) : (
              <NotFoundPage />
            )
          }
        />
        <Route
          path="/admin/categories"
          element={
            publishableKey ? (
              <AdminRouteGuard>
                <AdminCategoriesPage />
              </AdminRouteGuard>
            ) : (
              <NotFoundPage />
            )
          }
        />
        {/* Legacy admin route fallback — keep for backward compat */}
        <Route
          path="/admin/legacy"
          element={
            publishableKey ? (
              <AdminRouteGuard>
                <AdminPage />
              </AdminRouteGuard>
            ) : (
              <NotFoundPage />
            )
          }
        />

        {/* ─── ORGANIZER DEDICATED UNIT ─── */}
        <Route
          path="/organizer"
          element={
            publishableKey ? (
              <OrganizerRouteGuard>
                <OrganizerOverviewPage />
              </OrganizerRouteGuard>
            ) : (
              <NotFoundPage />
            )
          }
        />
        <Route
          path="/organizer/events"
          element={
            publishableKey ? (
              <OrganizerRouteGuard>
                <OrganizerEventsPage />
              </OrganizerRouteGuard>
            ) : (
              <NotFoundPage />
            )
          }
        />
        <Route
          path="/organizer/sales"
          element={
            publishableKey ? (
              <OrganizerRouteGuard>
                <OrganizerSalesPage />
              </OrganizerRouteGuard>
            ) : (
              <NotFoundPage />
            )
          }
        />
        <Route
          path="/organizer/checkin"
          element={
            publishableKey ? (
              <OrganizerRouteGuard>
                <OrganizerCheckinHubPage />
              </OrganizerRouteGuard>
            ) : (
              <NotFoundPage />
            )
          }
        />
        <Route
          path="/organizer/profile"
          element={
            publishableKey ? (
              <OrganizerRouteGuard>
                <OrganizerProfilePage />
              </OrganizerRouteGuard>
            ) : (
              <NotFoundPage />
            )
          }
        />
        <Route
          path="/organizer/events/:eventId/check-in"
          element={
            publishableKey ? (
              <OrganizerRouteGuard>
                <DashboardShell role="ORGANIZER" pageTitle="Door Check-in Console">
                  <EventCheckinPage />
                </DashboardShell>
              </OrganizerRouteGuard>
            ) : (
              <NotFoundPage />
            )
          }
        />

        {/* Account / Workspace (Attendees only — Admin/Organizer redirect above) */}
        <Route path="/account" element={publishableKey ? <AccountPage /> : <NotFoundPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {!isDedicatedWorkspace && <PublicFooter />}
    </div>
  )
}

export default function App() {
  return (
    <CurrentUserProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </CurrentUserProvider>
  )
}
