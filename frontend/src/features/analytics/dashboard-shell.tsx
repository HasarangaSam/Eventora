import { type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { UserButton } from '@clerk/react'
import { useCurrentUser } from '../auth/current-user-context'
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
    <div className="flex min-h-screen bg-slate-50" data-role={role.toLowerCase()}>
      {/* Sidebar Navigation */}
      <aside className="sticky top-0 flex h-screen w-[270px] shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-400">
        <div className="border-b border-slate-800 px-6 pt-6 pb-5">
          <Link className="w-fit rounded-md transition-opacity hover:opacity-85" to={homeDestination}>
            <EventoraLogo tone="light" />
          </Link>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.15)] px-2 py-[3px] text-[11px] font-bold tracking-[0.5px] text-indigo-400 uppercase">
            {role === 'ADMIN' ? 'Platform Admin' : role === 'ORGANIZER' ? 'Organizer Studio' : 'Attendee Account'}
          </div>
        </div>

        <nav className="m-0 flex flex-1 list-none flex-col gap-1 px-3 py-[18px]" aria-label={`${role.toLowerCase()} navigation`}>
          {navItems.map((item) => {
            const isMatch = item.to === '/admin' || item.to === '/organizer'
              ? pathname === item.to
              : pathname.startsWith(item.to)

            return (
              <div key={item.label}>
                <Link
                  to={item.to}
                  className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3.5 py-2.5 text-left text-sm font-medium text-slate-400 transition-[all] duration-150 hover:bg-[rgba(255,255,255,0.06)] hover:text-white aria-[current=page]:bg-[var(--primary)] aria-[current=page]:font-semibold aria-[current=page]:text-white aria-[current=page]:shadow-[0_2px_8px_rgba(99,102,241,0.35)] [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:shrink-0"
                  aria-current={isMatch ? 'page' : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </div>
            )
          })}
        </nav>

        <div className="flex items-center justify-between border-t border-slate-800 px-5 py-4">
          <div className="flex flex-col gap-0.5 text-[13px]">
            <strong className="font-semibold text-white">{user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : (user?.email?.split('@')[0] ?? 'User')}</strong>
            <span className="text-[11px] text-slate-500">{user?.email ?? ''}</span>
          </div>
          <UserButton />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between border-b border-[var(--border)] bg-white px-8">
          <div className="text-lg font-bold text-[var(--text-main)]">{defaultTopTitle}</div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none capitalize border border-[#c7d2fe] bg-[#eef2ff] text-[#4f46e5] [--badge-dot-color:#6366f1]">
              <span className="h-[6px] w-[6px] rounded-full bg-[var(--badge-dot-color)]" />
              {role.toLowerCase()}
            </span>
          </div>
        </header>

        <main className="w-full max-w-[1400px] flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}
