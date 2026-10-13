import { Link, Route, Routes, useLocation } from 'react-router'
import { useAuth } from '@clerk/react'
import type { ReactNode } from 'react'
import { PublicFooter, PublicHeader } from '../components/layout/public-site'
import { AccountPage } from '../features/auth/account-page'
import { AdminPage } from '../features/admin/admin-page'
import { AdminOverviewPage } from '../features/admin/admin-overview-page'
import { AdminApplicationsPage } from '../features/admin/admin-applications-page'
import { AdminEventsPage } from '../features/admin/admin-events-page'
import { AdminUsersPage } from '../features/admin/admin-users-page'
import { AdminCategoriesPage } from '../features/admin/admin-categories-page'
import { AdminPaymentsPage, AdminReportsPage } from '../features/admin/admin-finance-pages'
import { AdminNotificationsPage } from '../features/admin/admin-notifications-page'
import { DiscoveryPage } from '../features/events/discovery-page'
import { EventDetailPage } from '../features/events/event-detail-page'
import { CheckoutResultPage } from '../features/payments/checkout-result-page'
import { TicketsPage } from '../features/tickets/tickets-page'
import { EventCheckinPage } from '../features/organizer/event-checkin-page'
import { AuthPage } from '../features/auth/auth-page'
import { HomePage } from '../features/home/home-page'
import { DashboardShell } from '../features/analytics/dashboard-shell'
import { OrganizerOverviewPage } from '../features/organizer/organizer-overview-page'
import { OrganizerEventsPage, OrganizerParticipantsPage, OrganizerSalesPage, OrganizerSalesReportPage } from '../features/organizer/organizer-pages'
import { OrganizerCheckinHubPage } from '../features/organizer/organizer-checkin-hub-page'
import { OrganizerProfilePage } from '../features/organizer/organizer-profile-page'
import { OrganizerNotificationsPage } from '../features/organizer/organizer-notifications-page'
import { AdminRouteGuard, OrganizerRouteGuard, PublicRouteGuard, useCurrentUser } from '../features/auth/current-user-context'

function NotFoundPage() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 font-medium text-[var(--text-muted)]">
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none capitalize border border-[#fecaca] bg-[#fef2f2] text-[#dc2626] [--badge-dot-color:#ef4444]">404 Error</span>
      <h1 className="text-[32px] font-extrabold">Page not found</h1>
      <p className="text-muted">The page you were looking for doesn't exist or has moved.</p>
      <Link className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px]" to="/">Back to Eventora</Link>
    </main>
  )
}

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const unavailable = <NotFoundPage />
const admin = (element: ReactNode) => publishableKey ? <AdminRouteGuard>{element}</AdminRouteGuard> : unavailable
const organizer = (element: ReactNode) => publishableKey ? <OrganizerRouteGuard>{element}</OrganizerRouteGuard> : unavailable

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicRouteGuard><HomePage /></PublicRouteGuard>} />
      <Route path="/discover" element={<PublicRouteGuard><DiscoveryPage /></PublicRouteGuard>} />
      <Route path="/events/:eventId" element={<EventDetailPage />} />
      <Route path="/checkout/result" element={<CheckoutResultPage />} />
      <Route path="/checkout/cancelled" element={<CheckoutResultPage cancelled />} />
      <Route path="/tickets" element={publishableKey ? <TicketsPage /> : unavailable} />
      <Route path="/sign-in/*" element={publishableKey ? <AuthPage mode="sign-in" /> : unavailable} />
      <Route path="/sign-up/*" element={publishableKey ? <AuthPage mode="sign-up" /> : unavailable} />
      <Route path="/admin" element={admin(<AdminOverviewPage />)} />
      <Route path="/admin/applications" element={admin(<AdminApplicationsPage />)} />
      <Route path="/admin/events" element={admin(<AdminEventsPage />)} />
      <Route path="/admin/users" element={admin(<AdminUsersPage />)} />
      <Route path="/admin/categories" element={admin(<AdminCategoriesPage />)} />
      <Route path="/admin/notifications" element={admin(<AdminNotificationsPage />)} />
      <Route path="/admin/payments" element={admin(<AdminPaymentsPage />)} />
      <Route path="/admin/reports" element={admin(<AdminReportsPage />)} />
      <Route path="/admin/legacy" element={admin(<AdminPage />)} />
      <Route path="/organizer" element={organizer(<OrganizerOverviewPage />)} />
      <Route path="/organizer/events" element={organizer(<OrganizerEventsPage />)} />
      <Route path="/organizer/participants" element={organizer(<OrganizerParticipantsPage />)} />
      <Route path="/organizer/notifications" element={organizer(<OrganizerNotificationsPage />)} />
      <Route path="/organizer/sales" element={organizer(<OrganizerSalesPage />)} />
      <Route path="/organizer/sales/:eventId" element={organizer(<OrganizerSalesReportPage />)} />
      <Route path="/organizer/checkin" element={organizer(<OrganizerCheckinHubPage />)} />
      <Route path="/organizer/profile" element={organizer(<OrganizerProfilePage />)} />
      <Route path="/organizer/events/:eventId/check-in" element={organizer(
        <DashboardShell role="ORGANIZER" pageTitle="Door Check-in Console"><EventCheckinPage /></DashboardShell>,
      )} />
      <Route path="/account" element={publishableKey ? <AccountPage /> : unavailable} />
      <Route path="*" element={unavailable} />
    </Routes>
  )
}

export function RoutedApplication() {
  const location = useLocation()
  const { role, isLoading } = useCurrentUser()
  const { isLoaded, isSignedIn } = useAuth()
  const dedicated = location.pathname.startsWith('/admin') || location.pathname.startsWith('/organizer') ||
    location.pathname.startsWith('/sign-in') || location.pathname.startsWith('/sign-up') ||
    (location.pathname === '/account' && (role === 'ORGANIZER' || role === 'ADMIN'))

  if (isLoaded && isSignedIn && isLoading) {
    return <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 font-medium text-slate-600" role="status" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-indigo-100 border-t-indigo-600" />
      <p className="m-0">Opening your workspace…</p>
    </main>
  }

  return (
    <div className="flex min-h-screen flex-col">
      {!dedicated && <PublicHeader />}
      <AppRoutes />
      {!dedicated && <PublicFooter />}
    </div>
  )
}
