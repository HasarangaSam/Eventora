import { SignInButton, SignUpButton, UserButton } from '@clerk/react'
import { useEffect, useState } from 'react'
import { Link, Route, Routes } from 'react-router'
import { api } from './lib/api'
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
      <section className="discover" id="discover" aria-labelledby="discover-title">
        <div className="section-heading">
          <div><span className="eyebrow">A little inspiration</span><h2 id="discover-title">Find your kind of event.</h2></div>
          <p>Fresh experiences are on their way.<br />Check back soon to see what’s happening.</p>
        </div>
        <div className="empty-state"><span aria-hidden="true">✳</span><p>We’re getting the good stuff ready.</p></div>
      </section>
      <footer className="site-footer"><Link className="brand" to="/">eventora<span>.</span></Link><span>Made for moments worth sharing.</span><span className="api-status"><i className={`api-status__dot api-status__dot--${apiStatus}`} /> API {apiStatus === 'checking' ? 'checking' : apiStatus}</span></footer>
    </main>
  )
}

function NotFoundPage() {
  return <main className="not-found"><span className="eyebrow">That page wandered off</span><h1>Nothing happening here.</h1><Link className="button button--dark" to="/">Back to Eventora</Link></main>
}

export default function App() {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="Eventora home">eventora<span>.</span></Link>
        <nav className="site-nav" aria-label="Main navigation"><a href="/#discover">Discover</a></nav>
        <div className="account-actions">
          {publishableKey ? <>
            <SignInButton mode="modal"><button className="text-button">Sign in</button></SignInButton>
            <SignUpButton mode="modal"><button className="button button--small">Get started <span aria-hidden="true">↗</span></button></SignUpButton>
            <UserButton />
          </> : <span className="setup-hint">Add Clerk key to enable sign in</span>}
        </div>
      </header>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  )
}
