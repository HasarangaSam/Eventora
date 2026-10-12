import { type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { UserButton } from '@clerk/react'
import { useCurrentUser } from '../auth/current-user-context'
import {
  IconShield,
  IconCalendar,
  IconUsers,
  IconTicket,
  IconCamera,
  IconSparkles,
} from '../../components/ui/icons'

type Role = 'ATTENDEE' | 'ORGANIZER' | 'ADMIN'

interface DashboardShellProps {
  role: Role
  children: ReactNode
  pageTitle?: string
}

// Simple person icon for profile
function IconPerson() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

// Chart icon for analytics
function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
      <path d="M3 3v18h18" />
      <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
    </svg>
  )
}

export function DashboardShell({ role, children, pageTitle }: DashboardShellProps) {
  const { pathname } = useLocation()
  const { user } = useCurrentUser()

  const adminLinks = [
    { label: 'Overview', to: '/admin', icon: <IconShield /> },
    { label: 'Applications Queue', to: '/admin/applications', icon: <IconUsers /> },
    { label: 'Events Oversight', to: '/admin/events', icon: <IconCalendar /> },
    { label: 'User Governance', to: '/admin/users', icon: <IconUsers /> },
    { label: 'Category Taxonomy', to: '/admin/categories', icon: <IconSparkles /> },
  ]

  const organizerLinks = [
    { label: 'Overview', to: '/organizer', icon: <IconChart /> },
    { label: 'Events Studio', to: '/organizer/events', icon: <IconCalendar /> },
    { label: 'Sales & Revenue', to: '/organizer/sales', icon: <IconTicket /> },
    { label: 'Door Check-in', to: '/organizer/checkin', icon: <IconCamera /> },
    { label: 'My Profile', to: '/organizer/profile', icon: <IconPerson /> },
  ]

  const attendeeLinks = [
    { label: 'Account Overview', to: '/account', icon: <IconUsers /> },
    { label: 'My Digital Passes', to: '/tickets', icon: <IconTicket /> },
  ]

  const navItems = role === 'ADMIN' ? adminLinks : role === 'ORGANIZER' ? organizerLinks : attendeeLinks
  const homeDestination = role === 'ADMIN' ? '/admin' : role === 'ORGANIZER' ? '/organizer' : '/'

  const defaultTopTitle =
    pageTitle ??
    (role === 'ADMIN'
      ? 'Platform Administration & Oversight'
      : role === 'ORGANIZER'
        ? 'Organizer Studio & Management'
        : 'Attendee Account')

  return (
    <div className="dashboard-unit" data-role={role.toLowerCase()}>
      {/* Sidebar Navigation */}
      <aside className="dashboard-sidebar-unit">
        <div className="dashboard-sidebar-header">
          <Link className="brand" to={homeDestination}>
            eventora<span className="brand-dot">.</span>
          </Link>
          <div className="dashboard-role-badge">
            {role === 'ADMIN' ? 'Platform Admin' : role === 'ORGANIZER' ? 'Organizer Studio' : 'Attendee Account'}
          </div>
        </div>

        <nav className="dashboard-nav-list" aria-label={`${role.toLowerCase()} navigation`}>
          {navItems.map((item) => {
            const isMatch = item.to === '/admin' || item.to === '/organizer'
              ? pathname === item.to
              : pathname.startsWith(item.to)

            return (
              <div key={item.label} className="dashboard-nav-item">
                <Link
                  to={item.to}
                  className={isMatch ? 'active' : ''}
                  aria-current={isMatch ? 'page' : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </div>
            )
          })}
        </nav>

        <div className="dashboard-sidebar-footer">
          <div className="dashboard-user-info">
            <strong>{user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : (user?.email?.split('@')[0] ?? 'User')}</strong>
            <span>{user?.email ?? ''}</span>
          </div>
          <UserButton />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="dashboard-main-area">
        <header className="dashboard-topbar">
          <div className="dashboard-topbar-title">{defaultTopTitle}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span className="badge badge-indigo">
              <span className="badge-dot" />
              {role.toLowerCase()}
            </span>
          </div>
        </header>

        <main className="dashboard-body">{children}</main>
      </div>
    </div>
  )
}
