import { useState } from 'react'
import { UserButton, useAuth } from '@clerk/react'
import { Link, useLocation } from 'react-router'
import { useCurrentUser } from '../../features/auth/current-user-context'
import { LinkButton } from '../ui/link-button'
import { IconMenu, IconX } from '../ui/icons'
import { EventoraLogo } from './eventora-logo'

export function PublicHeader() {
  const location = useLocation()
  const { isLoaded, isSignedIn } = useAuth()
  const { role } = useCurrentUser()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (path: string) => location.pathname === path
  const navLinkClass = (path: string) =>
    `relative rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors duration-150 ${isActive(path) ? 'bg-white text-indigo-700 shadow-[0_1px_3px_rgba(15,23,42,0.1)]' : 'text-slate-500 hover:bg-white/70 hover:text-slate-900'}`

  return (
    <header id="top" className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 shadow-[0_2px_12px_rgba(15,23,42,0.035)] backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] w-full max-w-[1280px] items-center justify-between px-6 max-[640px]:px-4">
        <div className="flex items-center gap-10">
          <Link className="rounded-md transition-opacity hover:opacity-85" to="/" aria-label="Eventora home">
            <EventoraLogo />
          </Link>
          <nav className="hidden items-center gap-1 rounded-full border border-slate-200/80 bg-slate-50/90 p-1 min-[769px]:flex" aria-label="Main navigation">
            <Link className={navLinkClass('/')} aria-current={isActive('/') ? 'page' : undefined} to="/">Home</Link>
            <Link className={navLinkClass('/discover')} aria-current={isActive('/discover') ? 'page' : undefined} to="/discover">Discover</Link>
            {role === 'ATTENDEE' && <Link className={navLinkClass('/tickets')} aria-current={isActive('/tickets') ? 'page' : undefined} to="/tickets">My Tickets</Link>}
          </nav>
        </div>
        <div className="flex items-center gap-2.5">
          {!isLoaded ? <span className="text-xs text-slate-400">Loading…</span> : !isSignedIn ? (
            <>
              <LinkButton variant="subtle" size="small" className="max-[420px]:hidden" to="/sign-in">Sign in</LinkButton>
              <LinkButton size="small" className="rounded-[9px] px-4 shadow-[0_3px_9px_rgba(79,70,229,0.25)]" to="/sign-up">Sign up</LinkButton>
            </>
          ) : (
            <>
              <LinkButton variant="secondary" size="small" className="max-[420px]:hidden" to="/account">Dashboard</LinkButton>
              <UserButton />
            </>
          )}
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 min-[769px]:hidden"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <IconX className="size-4" /> : <IconMenu className="size-4" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <nav id="mobile-navigation" className="border-t border-slate-100 bg-white px-4 py-3 shadow-[0_12px_18px_-16px_rgba(15,23,42,0.3)] min-[769px]:hidden" aria-label="Mobile navigation">
          <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-1">
            {[
              { label: 'Home', to: '/' },
              { label: 'Discover events', to: '/discover' },
              ...(role === 'ATTENDEE' ? [{ label: 'My tickets', to: '/tickets' }] : []),
              ...(isSignedIn ? [{ label: 'Dashboard', to: '/account' }] : []),
              ...(!isSignedIn ? [{ label: 'Sign in', to: '/sign-in' }] : []),
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isActive(item.to) ? 'page' : undefined}
                className={`rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${isActive(item.to) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-slate-800 bg-slate-900 pt-[60px] pb-[30px] text-slate-400">
      <div className="mx-auto w-full max-w-[1280px] px-6">
        <div className="mb-10 grid grid-cols-[2fr_1fr_1fr] gap-10 max-[700px]:grid-cols-2 max-[520px]:grid-cols-1 max-[520px]:gap-8">
          <div>
            <Link className="rounded-md transition-opacity hover:opacity-85" to="/"><EventoraLogo tone="light" /></Link>
            <p className="mt-3 max-w-[320px] text-sm leading-[1.6]">Discover and host experiences worth leaving home for. Verified ticketing and entry management.</p>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">Explore</h4>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[13px] [&_a]:text-slate-400 [&_a]:transition-colors [&_a:hover]:text-white">
              <li><Link to="/">Home</Link></li>
              <li><Link to="/discover">Discover Events</Link></li>
              <li><Link to="/tickets">My Ticket Wallet</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">Organizers</h4>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[13px] [&_a]:text-slate-400 [&_a]:transition-colors [&_a:hover]:text-white">
              <li><Link to="/account">Organizer Portal</Link></li>
              <li><Link to="/account">Apply for Accreditation</Link></li>
            </ul>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-800 pt-6 text-[13px]">
          <span>© 2026 Eventora Platform. All rights reserved.</span>
          <a href="#top" className="text-inherit">Back to top ↑</a>
        </div>
      </div>
    </footer>
  )
}
