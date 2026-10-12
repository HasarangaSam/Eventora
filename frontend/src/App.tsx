import { SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/react'
import { useEffect, useState } from 'react'
import { Link, Route, Routes } from 'react-router'
import { api } from './lib/api'
import { AccountPage } from './features/auth/account-page'
import { AdminPage } from './features/admin/admin-page'
import { DiscoveryPage, FeaturedEvents } from './features/events/discovery-page'
import { EventDetailPage } from './features/events/event-detail-page'
import { CheckoutResultPage } from './features/payments/checkout-result-page'
import { TicketsPage } from './features/tickets/tickets-page'
import { EventCheckinPage } from './features/organizer/event-checkin-page'
import './App.css'

function HomePage() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  useEffect(() => {
    let active = true
    api.get('/health').then(() => { if (active) setApiStatus('online') }).catch(() => { if (active) setApiStatus('offline') })
    return () => { active = false }
  }, [])

  return (
    <main>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__copy">
          <span className="eyebrow"><span className="eyebrow__dot" /> Find your next experience</span>
          <h1 id="hero-title">Make room for<br /><em>something memorable.</em></h1>
          <p>Discover live music, workshops, food festivals, and the people who make them special.</p>
          <a className="button button--dark" href="#discover">Explore events <span aria-hidden="true">↗</span></a>
          <div className="hero__note"><span className="hero__note-icon" aria-hidden="true">✳</span><span>Good plans start with<br /><strong>being there.</strong></span></div>
        </div>
        <div className="hero__image" role="img" aria-label="Friends enjoying a live outdoor music event">
          <div className="hero__image-caption"><span>OUT THERE, TOGETHER</span><span>01 — 04</span></div>
          <div className="hero__image-sticker">Make<br />a night<br /><strong>of it.</strong></div>
        </div>
      </section>
      <FeaturedEvents />
      <DiscoveryPage />
      <footer className="site-footer"><Link className="brand" to="/">eventora<span>.</span></Link><span>Made for moments worth sharing.</span><span className="api-status"><i className={`api-status__dot api-status__dot--${apiStatus}`} /> API {apiStatus === 'checking' ? 'checking' : apiStatus}</span></footer>
    </main>
  )
}

function NotFoundPage() {
  return <main className="not-found"><span className="eyebrow">That page wandered off</span><h1>Nothing happening here.</h1><Link className="button button--dark" to="/">Back to Eventora</Link></main>
}

function AccountActions() {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) return <span className="setup-hint" aria-live="polite">Loading account…</span>
  if (!isSignedIn) {
    return <>
      <SignInButton mode="modal"><button className="text-button">Sign in</button></SignInButton>
      <SignUpButton mode="modal"><button className="button button--small">Get started <span aria-hidden="true">↗</span></button></SignUpButton>
    </>
  }
  return <>
    <Link className="text-button" to="/account">My account</Link>
    <Link className="text-button" to="/tickets">My tickets</Link>
    <UserButton />
  </>
}

export default function App() {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="Eventora home">eventora<span>.</span></Link>
        <nav className="site-nav" aria-label="Main navigation"><a href="/#discover">Discover</a></nav>
        <div className="account-actions">
          {publishableKey ? <AccountActions /> : <span className="setup-hint">Add Clerk key to enable sign in</span>}
        </div>
      </header>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/events/:eventId" element={<EventDetailPage />} />
        <Route path="/checkout/result" element={<CheckoutResultPage />} />
        <Route path="/checkout/cancelled" element={<CheckoutResultPage cancelled />} />
        <Route path="/tickets" element={publishableKey ? <TicketsPage /> : <NotFoundPage />} />
        <Route path="/organizer/events/:eventId/check-in" element={publishableKey ? <EventCheckinPage /> : <NotFoundPage />} />
        <Route path="/account" element={publishableKey ? <AccountPage /> : <NotFoundPage />} />
        <Route path="/admin" element={publishableKey ? <AdminPage /> : <NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  )
}
