import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { UserButton } from '@clerk/react'
import { useCurrentUser } from '../auth/current-user-context'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { EventoraLogo } from '../../components/layout/eventora-logo'
import {
  IconShield,
  IconCalendar,
  IconUsers,
  IconTicket,
  IconCamera,
  IconSparkles,
} from '../../components/ui/icons'

type Role = 'ATTENDEE' | 'ORGANIZER' | 'ADMIN'
type NavItem = { label: string; to: string; icon: ReactNode; group?: string; badge?: number }
type WorkspaceNotificationCount = { unreadCount: number; pendingApplications?: number }

interface DashboardShellProps {
  role: Role
  children: ReactNode
  pageTitle?: string
}

// Simple person icon for profile
function IconPerson() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

// Chart icon for analytics
function IconChart() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
    </svg>
  )
}

function IconBell() {
  return <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
}

export function DashboardShell({ role, children, pageTitle }: DashboardShellProps) {
  const { pathname } = useLocation()
  const { user } = useCurrentUser()
  const request = useAuthenticatedApi()
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [pendingApplications, setPendingApplications] = useState(0)

  const refreshNotifications = useCallback(async () => {
    if (role !== 'ADMIN' && role !== 'ORGANIZER') return
    try {
      const endpoint = role === 'ADMIN' ? '/admin/notifications' : '/organizer/notifications'
      const { data } = await request<WorkspaceNotificationCount>({ method: 'GET', url: endpoint })
      setUnreadNotificationCount(data.unreadCount)
      setPendingApplications(data.pendingApplications ?? 0)
    } catch {
      setUnreadNotificationCount(0)
      setPendingApplications(0)
    }
  }, [request, role])

  useEffect(() => {
    if (role !== 'ADMIN' && role !== 'ORGANIZER') return
    void refreshNotifications()
    const onFocus = () => { void refreshNotifications() }
    const onVisibility = () => { if (document.visibilityState === 'visible') void refreshNotifications() }
    const onNotificationsUpdated = () => { void refreshNotifications() }
    const onOrganizerNotificationsUpdated = () => { if (role === 'ORGANIZER') void refreshNotifications() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('admin-notifications-updated', onNotificationsUpdated)
    window.addEventListener('organizer-notifications-updated', onOrganizerNotificationsUpdated)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('admin-notifications-updated', onNotificationsUpdated)
      window.removeEventListener('organizer-notifications-updated', onOrganizerNotificationsUpdated)
    }
  }, [pathname, refreshNotifications, role])

  const adminLinks: NavItem[] = [
    { label: 'Overview', to: '/admin', icon: <IconShield /> },
    { label: 'Organizer applications', to: '/admin/applications', icon: <IconUsers />, badge: pendingApplications },
    { label: 'Events', to: '/admin/events', icon: <IconCalendar />, group: 'Manage platform' },
    { label: 'Accounts', to: '/admin/users', icon: <IconUsers /> },
    { label: 'Categories', to: '/admin/categories', icon: <IconSparkles /> },
    { label: 'Payments', to: '/admin/payments', icon: <IconTicket />, group: 'Reports' },
    { label: 'Reports', to: '/admin/reports', icon: <IconChart /> },
  ]

  const organizerLinks: NavItem[] = [
    { label: 'Overview', to: '/organizer', icon: <IconChart /> },
    { label: 'Events', to: '/organizer/events', icon: <IconCalendar />, group: 'Manage events' },
    { label: 'Participants', to: '/organizer/participants', icon: <IconUsers /> },
    { label: 'Sales', to: '/organizer/sales', icon: <IconTicket />, group: 'Track activity' },
    { label: 'Notifications', to: '/organizer/notifications', icon: <IconBell />, badge: unreadNotificationCount },
    { label: 'Check-in', to: '/organizer/checkin', icon: <IconCamera />, group: 'Event day' },
    { label: 'Organizer profile', to: '/organizer/profile', icon: <IconPerson />, group: 'Account' },
  ]

  const attendeeLinks: NavItem[] = [
    { label: 'Account Overview', to: '/account', icon: <IconUsers /> },
    { label: 'My Digital Passes', to: '/tickets', icon: <IconTicket /> },
  ]

  const navItems = role === 'ADMIN' ? adminLinks : role === 'ORGANIZER' ? organizerLinks : attendeeLinks
  const homeDestination = role === 'ADMIN' ? '/admin' : role === 'ORGANIZER' ? '/organizer' : '/'
  const isNavActive = (item: NavItem) => {
    if (item.to === '/admin' || item.to === '/organizer') return pathname === item.to
    if (item.to === '/organizer/checkin' && pathname.endsWith('/check-in')) return true
    if (item.to === '/organizer/events' && pathname.includes('/check-in')) return false
    return pathname.startsWith(item.to)
  }

  const defaultTopTitle =
    pageTitle ??
    (role === 'ADMIN'
      ? 'Platform Administration & Oversight'
      : role === 'ORGANIZER'
        ? 'Organizer Studio & Management'
        : 'Attendee Account')

  return (
    <div className="flex min-h-screen bg-slate-50" data-role={role.toLowerCase()}>
      {/* Sidebar Navigation */}
      <aside className="sticky top-0 hidden h-screen w-[250px] shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-400 lg:flex">
        <div className="border-b border-slate-800 px-6 pt-6 pb-5">
          <Link className="w-fit rounded-md transition-opacity hover:opacity-85" to={homeDestination}>
            <EventoraLogo tone="light" />
          </Link>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.15)] px-2 py-[3px] text-[11px] font-bold tracking-[0.5px] text-indigo-400 uppercase">
            {role === 'ADMIN' ? 'Platform Admin' : role === 'ORGANIZER' ? 'Organizer Studio' : 'Attendee Account'}
          </div>
        </div>

        <nav className="m-0 flex flex-1 list-none flex-col gap-1 px-3 py-[18px]" aria-label={`${role.toLowerCase()} navigation`}>
          {navItems.map((item, index) => {
            const isMatch = isNavActive(item)

            return (
              <div key={item.label}>
                {item.group && (index === 0 || navItems[index - 1].group !== item.group) && <p className="mb-1 mt-5 px-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{item.group}</p>}
                <Link
                  to={item.to}
                  className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3.5 py-2.5 text-left text-sm font-medium text-slate-400 transition-[all] duration-150 hover:bg-[rgba(255,255,255,0.06)] hover:text-white aria-[current=page]:bg-[var(--primary)] aria-[current=page]:font-semibold aria-[current=page]:text-white aria-[current=page]:shadow-[0_2px_8px_rgba(99,102,241,0.35)] [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:shrink-0"
                  aria-current={isMatch ? 'page' : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {role === 'ADMIN' && item.badge !== undefined && item.badge > 0 && <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{item.badge > 99 ? '99+' : item.badge}</span>}
                </Link>
              </div>
            )
          })}
        </nav>

      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between border-b border-[var(--border)] bg-white px-8">
          <div className="text-lg font-bold text-[var(--text-main)]">{defaultTopTitle}</div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">{user?.firstName ? `Hi, ${user.firstName}` : 'Your workspace'}</span>
            {(role === 'ADMIN' || role === 'ORGANIZER') && <Link to={role === 'ADMIN' ? '/admin/notifications' : '/organizer/notifications'} aria-label={`Notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread updates` : ''}`} title={unreadNotificationCount ? `${unreadNotificationCount} unread updates` : 'Notifications'} className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              <IconBell />
              {unreadNotificationCount > 0 && <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 py-0.5 text-[10px] font-bold leading-none text-white">{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span>}
            </Link>}
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none capitalize border border-[#c7d2fe] bg-[#eef2ff] text-[#4f46e5] [--badge-dot-color:#6366f1]">
              <span className="h-[6px] w-[6px] rounded-full bg-[var(--badge-dot-color)]" />
              {role.toLowerCase()}
            </span>
            <UserButton />
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 lg:hidden" aria-label={`${role.toLowerCase()} navigation`}>
          {navItems.map((item) => {
            const isMatch = isNavActive(item)
            return <Link key={item.to} to={item.to} aria-current={isMatch ? 'page' : undefined} className="inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-600 aria-[current=page]:bg-indigo-50 aria-[current=page]:font-semibold aria-[current=page]:text-indigo-700">{item.icon}{item.label}{role === 'ADMIN' && item.badge !== undefined && item.badge > 0 && <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{item.badge > 99 ? '99+' : item.badge}</span>}</Link>
          })}
        </nav>

        <main className="w-full max-w-[1600px] flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
