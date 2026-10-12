import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'

type Role = 'ATTENDEE' | 'ORGANIZER' | 'ADMIN'

export function DashboardShell({ role, children }: { role: Role; children: ReactNode }) {
  const { pathname } = useLocation()
  const links = role === 'ADMIN' ? [
    { label: 'Overview', to: '/account' }, { label: 'Applications & accounts', to: '/admin' }, { label: 'Explore events', to: '/discover' },
  ] : role === 'ORGANIZER' ? [
    { label: 'Overview', to: '/account' }, { label: 'My events', to: '/account#organizer-events' }, { label: 'Sales & attendance', to: '/account#analytics' }, { label: 'Discover events', to: '/discover' },
  ] : [
    { label: 'Overview', to: '/account' }, { label: 'My tickets', to: '/tickets' }, { label: 'Discover events', to: '/discover' },
  ]
  return <div className="dashboard-shell"><aside className="dashboard-sidebar"><span className="dashboard-sidebar__label">{role === 'ADMIN' ? 'Platform' : role === 'ORGANIZER' ? 'Organizer' : 'Your Eventora'}</span><nav aria-label={`${role.toLowerCase()} dashboard navigation`}>{links.map(link => <Link key={link.label} aria-current={pathname === link.to.split('#')[0] ? 'page' : undefined} to={link.to}>{link.label}</Link>)}</nav><div className="dashboard-sidebar__foot"><span>Signed in as</span><strong>{role.toLowerCase()}</strong><Link to="/">← Return to events</Link></div></aside><div className="dashboard-content">{children}</div></div>
}
