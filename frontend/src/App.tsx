import { UserButton, useAuth } from '@clerk/react'
import { Link, Route, Routes, useLocation } from 'react-router'
import { AccountPage } from './features/auth/account-page'
import { AdminPage } from './features/admin/admin-page'
import { DiscoveryPage, ExploreCategories, RecentEvents } from './features/events/discovery-page'
import { EventDetailPage } from './features/events/event-detail-page'
import { CheckoutResultPage } from './features/payments/checkout-result-page'
import { TicketsPage } from './features/tickets/tickets-page'
import { EventCheckinPage } from './features/organizer/event-checkin-page'
import { AuthPage } from './features/auth/auth-page'
import './App.css'

function HomePage() {
  return <main className="home-page">
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__copy"><span className="eyebrow"><span className="eyebrow__dot" /> Find your next experience</span>
        <h1 id="hero-title">Find your next<br /><em>experience.</em></h1>
        <p>Discover events worth leaving home for, from workshops and conferences to music and community gatherings.</p>
        <Link className="button button--dark" to="/discover">Discover events <span aria-hidden="true">↗</span></Link>
        <div className="hero__note"><span className="hero__note-icon" aria-hidden="true">✳</span><span>Good plans start with<br /><strong>being there.</strong></span></div>
      </div>
      <div className="hero__image" role="img" aria-label="Friends enjoying an outdoor event"><div className="hero__image-caption"><span>MAKE A DAY OF IT</span><span>EVENTORA</span></div></div>
    </section>
    <RecentEvents />
    <ExploreCategories />
    <section className="home-how" id="about" aria-labelledby="how-title"><div className="home-how__intro"><span className="eyebrow">From discovery to door</span><h2 id="how-title">A better way to<br /><em>make a plan.</em></h2></div><div className="home-how__steps">
      <article><span>01</span><div><h3>Find your kind of event</h3><p>Explore published events by interest, date, or city and get the details before you decide.</p></div></article>
      <article><span>02</span><div><h3>Book with confidence</h3><p>Choose a paid ticket and complete checkout securely through PayHere.</p></div></article>
      <article><span>03</span><div><h3>Bring your ticket</h3><p>After payment is verified, your digital ticket and QR code are ready in your account.</p></div></article>
    </div></section>
    <section className="organizer-cta"><div><span className="eyebrow">For people who bring people together</span><h2>Make your next event<br />a place to be.</h2><p>Apply to publish events, manage paid ticket sales, and check in attendees. Applications are reviewed by the Eventora team.</p><Link className="button button--light" to="/account">Become an organizer <span aria-hidden="true">↗</span></Link></div><span className="organizer-cta__mark" aria-hidden="true">e.</span></section>
  </main>
}

function PublicFooter() {
  return <footer className="public-footer"><div className="public-footer__top"><div><Link className="brand" to="/">eventora<span>.</span></Link><p>Discover something worth attending.</p></div><nav aria-label="Footer navigation"><Link to="/discover">Discover events</Link><Link to="/account">Become an organizer</Link><a href="/#about">About Eventora</a></nav></div><div className="public-footer__bottom"><span>Eventora · Event discovery and ticketing</span><a href="#top">Back to top ↑</a></div></footer>
}

function NotFoundPage() { return <main className="not-found"><span className="eyebrow">That page wandered off</span><h1>Nothing happening here.</h1><Link className="button button--dark" to="/">Back to Eventora</Link></main> }

function AccountActions() {
  const { isLoaded, isSignedIn } = useAuth()
  if (!isLoaded) return <span className="setup-hint" aria-live="polite">Loading account…</span>
  if (!isSignedIn) return <><Link className="text-button" to="/sign-in">Sign in</Link><Link className="button button--small" to="/sign-up">Sign up <span aria-hidden="true">↗</span></Link></>
  return <><Link className="text-button" to="/account">My dashboard</Link><Link className="text-button" to="/tickets">My tickets</Link><UserButton /></>
}

function PublicHeader() {
  const location = useLocation()
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
  return <header id="top" className="site-header"><Link className="brand" to="/" aria-label="Eventora home">eventora<span>.</span></Link>
    <nav className="site-nav" aria-label="Main navigation"><Link aria-current={location.pathname === '/' ? 'page' : undefined} to="/">Home</Link><Link aria-current={location.pathname === '/discover' ? 'page' : undefined} to="/discover">Discover</Link><Link to="/account">Become an organizer</Link></nav>
    <details className="site-mobile-menu"><summary>Menu</summary><nav aria-label="Mobile navigation"><Link to="/">Home</Link><Link to="/discover">Discover events</Link><Link to="/account">Become an organizer</Link>{import.meta.env.VITE_CLERK_PUBLISHABLE_KEY && <><Link to="/account">My dashboard</Link><Link to="/tickets">My tickets</Link></>}</nav></details>
    <div className="account-actions">{publishableKey ? <AccountActions /> : <span className="setup-hint">Sign-in is temporarily unavailable</span>}</div>
  </header>
}

export default function App() {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
  return <div className="app-shell"><PublicHeader /><Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/discover" element={<DiscoveryPage />} />
    <Route path="/sign-in/*" element={publishableKey ? <AuthPage mode="sign-in" /> : <NotFoundPage />} />
    <Route path="/sign-up/*" element={publishableKey ? <AuthPage mode="sign-up" /> : <NotFoundPage />} />
    <Route path="/events/:eventId" element={<EventDetailPage />} />
    <Route path="/checkout/result" element={<CheckoutResultPage />} />
    <Route path="/checkout/cancelled" element={<CheckoutResultPage cancelled />} />
    <Route path="/tickets" element={publishableKey ? <TicketsPage /> : <NotFoundPage />} />
    <Route path="/organizer/events/:eventId/check-in" element={publishableKey ? <EventCheckinPage /> : <NotFoundPage />} />
    <Route path="/account" element={publishableKey ? <AccountPage /> : <NotFoundPage />} />
    <Route path="/admin" element={publishableKey ? <AdminPage /> : <NotFoundPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes><PublicFooter /></div>
}
