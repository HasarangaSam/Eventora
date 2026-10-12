import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../../lib/api'
import { EventCard, type PublicEventCard } from '../events/event-card'
import { PLACEHOLDER_IMAGES } from '../../lib/placeholders'
import {
  IconArrowRight,
  IconCheck,
  IconCheckCircle,
  IconCreditCard,
  IconMail,
  IconMapPin,
  IconQrCode,
  IconSearch,
  IconShield,
  IconSmartphone,
  IconTicket,
} from '../../components/ui/icons'

interface Category {
  id: string
  name: string
  slug: string
}

interface EventPage {
  items: PublicEventCard[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

const FAQ_ITEMS = [
  {
    question: 'How do I receive my ticket after registering and paying?',
    answer:
      'Immediately upon successful checkout, Eventora generates your verified ticket with an encrypted QR code. It is instantly emailed to your registered email address with a PDF pass, and also saved to your online Eventora Ticket Wallet so you can access it on any device at any time.',
  },
  {
    question: 'Do I need to print out the QR code ticket to enter?',
    answer:
      'No printing is necessary! Eventora is completely paperless. Simply open the email on your smartphone, save the pass to your photos, or open your Eventora account at the venue door. The organizer will scan the QR code right off your screen.',
  },
  {
    question: 'What payment methods are supported for booking?',
    answer:
      'We support all major payment options via our secure PayHere integration, including Visa, Mastercard, American Express, and popular local Sri Lankan bank transfer channels in Sri Lankan Rupees (LKR) with zero hidden checkout surcharges.',
  },
  {
    question: 'How does the door check-in QR code prevent fraud or duplicate tickets?',
    answer:
      'Each ticket issued by Eventora carries a cryptographically signed, single-use token embedded into the QR code. When scanned at the gate by the organizer’s console, the ticket is instantly validated and marked as attended in real time. Screenshots shared with others cannot be used once scanned.',
  },
  {
    question: 'How can I become an organizer and sell tickets for my own event?',
    answer:
      'Creating an organizer account is simple: create your Eventora account, head over to your account portal, and submit an organizer application. Once approved, you gain access to tier creation, real-time ticket sales charts, and the high-speed live camera door scanner console.',
  },
]

export function HomePage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [events, setEvents] = useState<PublicEventCard[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [eventsState, setEventsState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false)

  useEffect(() => {
    let active = true
    async function loadEvents() {
      try {
        const { data } = await api.get<EventPage>('/events?sort=newest&direction=desc&page=1&pageSize=6')
        if (active) {
          setEvents(data.items)
          setEventsState('ready')
        }
      } catch {
        if (active) setEventsState('error')
      }
    }

    async function loadCategories() {
      try {
        const { data } = await api.get<Category[]>('/categories')
        if (active) setCategories(data)
      } catch {
        // Categories are an optional homepage enhancement.
      }
    }

    void Promise.all([loadEvents(), loadCategories()])

    return () => {
      active = false
    }
  }, [])

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/discover?search=${encodeURIComponent(searchQuery.trim())}`)
    } else {
      navigate('/discover')
    }
  }

  const handleNewsletterSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (newsletterEmail.trim()) {
      setNewsletterSubscribed(true)
    }
  }

  return (
    <div className="home-wrapper">
      {/* ── 1. HERO SECTION (Editorial, Clean, Solid Typography) ── */}
      <section className="home-hero">
        <div className="public-container">
          <div className="home-hero-grid">
            <div className="home-hero-content">
              <h1 className="home-hero-title">
                Experiences worth leaving home for.
              </h1>

              <p className="home-hero-subtitle">
                The trusted platform for discovering conferences, concerts, and workshops.
                Instant registration, secure PayHere payments, and verified QR passes delivered straight to your email.
              </p>

              {/* Direct Search Form */}
              <form onSubmit={handleSearchSubmit} className="home-search-form">
                <div className="home-search-input-wrap">
                  <IconSearch className="home-search-icon" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search events by title, artist, or venue..."
                    className="home-search-input"
                    aria-label="Search events"
                  />
                </div>
                <button type="submit" className="home-search-btn">
                  Explore Events
                </button>
              </form>

              {/* Functional Category Filter Links (dynamically loaded from API) */}
              <div className="home-quick-tags">
                <span className="home-quick-tags-label">Popular:</span>
                {categories.length > 0 ? (
                  categories.slice(0, 4).map((cat) => (
                    <Link key={cat.id} to={`/discover?categoryId=${cat.id}`} className="home-tag-pill">
                      {cat.name}
                    </Link>
                  ))
                ) : (
                  <>
                    <Link to="/discover?search=Tech" className="home-tag-pill">Technology</Link>
                    <Link to="/discover?search=Music" className="home-tag-pill">Concerts</Link>
                    <Link to="/discover?search=Workshop" className="home-tag-pill">Workshops</Link>
                  </>
                )}
                <Link to="/discover" className="home-tag-pill home-tag-pill-all">All Events →</Link>
              </div>
            </div>

            {/* Hero Visual Card */}
            <div className="home-hero-visual">
              <div className="home-hero-media">
                <img
                  src={PLACEHOLDER_IMAGES.hero}
                  alt="Live festival and convention gathering"
                  className="home-hero-img"
                />
                <div className="home-hero-media-caption">
                  <div className="home-hero-caption-venue">
                    <IconMapPin style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                    <span>Colombo & Island-wide Venues</span>
                  </div>
                  <span className="home-hero-caption-note">100% Verified Entry</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. TRUST & ASSURANCE STRIP ── */}
      <section className="home-trust-strip">
        <div className="public-container">
          <div className="home-trust-grid">
            <div className="home-trust-item">
              <div className="home-trust-icon-box">
                <IconMail style={{ width: '20px', height: '20px' }} />
              </div>
              <div>
                <strong className="home-trust-title">Instant Email Delivery</strong>
                <p className="home-trust-desc">Tickets arrive in your inbox the second payment confirms.</p>
              </div>
            </div>

            <div className="home-trust-item">
              <div className="home-trust-icon-box">
                <IconQrCode style={{ width: '20px', height: '20px' }} />
              </div>
              <div>
                <strong className="home-trust-title">Encrypted QR Tickets</strong>
                <p className="home-trust-desc">Single-use, anti-counterfeit codes scanned at the door.</p>
              </div>
            </div>

            <div className="home-trust-item">
              <div className="home-trust-icon-box">
                <IconCreditCard style={{ width: '20px', height: '20px' }} />
              </div>
              <div>
                <strong className="home-trust-title">PayHere Checkout</strong>
                <p className="home-trust-desc">Official Sri Lankan gateway for all cards and local payments.</p>
              </div>
            </div>

            <div className="home-trust-item">
              <div className="home-trust-icon-box">
                <IconSmartphone style={{ width: '20px', height: '20px' }} />
              </div>
              <div>
                <strong className="home-trust-title">No Printing Needed</strong>
                <p className="home-trust-desc">Flash your phone screen at the entrance for &lt;1s admission.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. HOW IT WORKS: REGISTRATION, EMAIL & QR CODE EXPERIENCE ── */}
      <section className="home-section home-how-it-works-section">
        <div className="public-container">
          <div className="home-section-header">
            <span className="home-section-kicker">STEP-BY-STEP PROCESS</span>
            <h2 className="home-section-title">How Eventora Works</h2>
            <p className="home-section-subtitle">
              From choosing your seat to walking through the venue doors — simple, paperless, and completely secure.
            </p>
          </div>

          <div className="home-how-layout">
            {/* The 4 Steps */}
            <div className="home-steps-list">
              <div className="home-step-card">
                <div className="home-step-num">1</div>
                <div className="home-step-info">
                  <h3 className="home-step-title">Choose Your Event &amp; Ticket Tier</h3>
                  <p className="home-step-desc">
                    Browse verified live experiences, summits, and performances. Select your preferred tier (General Admission, VIP, or Early Bird) with upfront pricing and live seat availability.
                  </p>
                </div>
              </div>

              <div className="home-step-card">
                <div className="home-step-num">2</div>
                <div className="home-step-info">
                  <h3 className="home-step-title">1-Click Registration &amp; Secure Payment</h3>
                  <p className="home-step-desc">
                    Register or sign in with your account. Complete your purchase in seconds via PayHere with Visa, Mastercard, AMEX, or local payment channels in Sri Lankan Rupees.
                  </p>
                </div>
              </div>

              <div className="home-step-card">
                <div className="home-step-num">3</div>
                <div className="home-step-info">
                  <h3 className="home-step-title">Instant Email Confirmation with QR Pass</h3>
                  <p className="home-step-desc">
                    The second payment completes, an official confirmation email arrives in your inbox containing your verified digital ticket pass with an anti-counterfeit QR code.
                  </p>
                </div>
              </div>

              <div className="home-step-card">
                <div className="home-step-num">4</div>
                <div className="home-step-info">
                  <h3 className="home-step-title">Scan at the Door &amp; Walk Straight In</h3>
                  <p className="home-step-desc">
                    Arrive at the event, open the email or ticket pass on your phone, and let the door team scan your QR code with their live door console. You’re admitted in under one second.
                  </p>
                </div>
              </div>
            </div>

            {/* Visual Interactive Mockup: Email & QR Ticket Pass Preview */}
            <div className="home-ticket-demo-wrapper">
              <div className="home-ticket-demo-card">
                <div className="home-demo-email-banner">
                  <div className="home-demo-email-header">
                    <span className="home-demo-dot" style={{ background: '#ef4444' }} />
                    <span className="home-demo-dot" style={{ background: '#f59e0b' }} />
                    <span className="home-demo-dot" style={{ background: '#10b981' }} />
                    <span className="home-demo-email-title">Inbox · tickets@eventora.lk</span>
                  </div>
                  <div className="home-demo-email-body">
                    <span className="home-demo-tag">Delivered Instantly</span>
                    <strong className="home-demo-subject">Your Tickets for Colombo Tech Summit 2026</strong>
                    <span className="home-demo-to">Sent to: sarah.mendis@example.com</span>
                  </div>
                </div>

                {/* The Ticket Pass */}
                <div className="home-pass-card">
                  <div className="home-pass-top">
                    <div>
                      <span className="home-pass-badge">VIP ALL-ACCESS</span>
                      <h4 className="home-pass-title">Colombo Tech Summit 2026</h4>
                      <span className="home-pass-date">Sat, Nov 21 · 09:00 AM · Nelum Pokuna</span>
                    </div>
                    <div className="home-pass-logo">
                      eventora<span>.</span>
                    </div>
                  </div>

                  <div className="home-pass-divider">
                    <div className="home-pass-notch-left" />
                    <div className="home-pass-dash" />
                    <div className="home-pass-notch-right" />
                  </div>

                  <div className="home-pass-bottom">
                    <div className="home-pass-details">
                      <div className="home-pass-field">
                        <span className="home-field-label">ATTENDEE</span>
                        <strong className="home-field-value">Sarah Mendis</strong>
                      </div>
                      <div className="home-pass-field">
                        <span className="home-field-label">SEAT / TIER</span>
                        <strong className="home-field-value">Section A · VIP Row 3</strong>
                      </div>
                      <div className="home-pass-field">
                        <span className="home-field-label">TICKET REFERENCE</span>
                        <strong className="home-field-value">#EVT-8942-LK</strong>
                      </div>
                    </div>

                    <div className="home-pass-qr-box">
                      <div className="home-pass-qr-visual" aria-label="Sample QR Code">
                        <IconQrCode style={{ width: '72px', height: '72px', color: '#0f172a' }} />
                      </div>
                      <span className="home-pass-qr-note">Scan at entrance</span>
                    </div>
                  </div>

                  <div className="home-pass-footer">
                    <IconCheckCircle style={{ width: '15px', height: '15px', color: '#10b981' }} />
                    <span>Cryptographically signed · Single-use entry verification</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. FEATURED / UPCOMING EVENTS ── */}
      <section className="home-section">
        <div className="public-container">
          <div className="home-section-header home-section-header-split">
            <div>
              <h2 className="home-section-title">Upcoming Events</h2>
              <p className="home-section-subtitle">
                Handpicked conferences, concerts, and workshops happening soon.
              </p>
            </div>
            <Link to="/discover" className="btn btn-secondary home-see-all-btn">
              View All Events <IconArrowRight style={{ width: '15px', height: '15px' }} />
            </Link>
          </div>

          {eventsState === 'loading' ? (
            <div className="event-grid">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="event-card" style={{ height: '360px', background: '#f1f5f9', animation: 'pulse 1.5s infinite' }} />
              ))}
            </div>
          ) : eventsState === 'error' ? (
            <div className="table-card" style={{ padding: '36px', textAlign: 'center' }}>
              <p className="text-muted">Could not load featured events.</p>
              <Link to="/discover" className="btn btn-primary btn-sm">
                Browse Discovery Directory
              </Link>
            </div>
          ) : events.length ? (
            <div className="event-grid">
              {events.map((event) => (
                <EventCard event={event} key={event.id} />
              ))}
            </div>
          ) : (
            <div className="table-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No published events available right now. Check back soon!
            </div>
          )}
        </div>
      </section>

      {/* ── 5. BROWSE BY CATEGORY ── */}
      {categories.length > 0 && (
        <section className="home-section home-category-section">
          <div className="public-container">
            <div className="home-section-header">
              <h2 className="home-section-title">Explore by Category</h2>
              <p className="home-section-subtitle">
                Find experiences tailored to your passions and interests.
              </p>
            </div>

            <div className="home-category-grid">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  to={`/discover?categoryId=${encodeURIComponent(category.id)}`}
                  className="home-category-card"
                >
                  <div className="home-category-icon">
                    <IconTicket style={{ width: '22px', height: '22px' }} />
                  </div>
                  <strong className="home-category-name">{category.name}</strong>
                  <span className="home-category-link">Browse events →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 6. WHY EVENTORA / PLATFORM INTEGRITY ── */}
      <section className="home-section home-features-section">
        <div className="public-container">
          <div className="home-section-header">
            <span className="home-section-kicker">BUILT FOR RELIABILITY</span>
            <h2 className="home-section-title">Why Eventora Stands Apart</h2>
            <p className="home-section-subtitle">
              Engineered from the ground up for seamless attendee experiences and ironclad organizer operations.
            </p>
          </div>

          <div className="home-features-grid">
            <div className="home-feature-card">
              <div className="home-feature-icon-box">
                <IconShield style={{ width: '22px', height: '22px' }} />
              </div>
              <h3 className="home-feature-title">Anti-Counterfeit QR Security</h3>
              <p className="home-feature-desc">
                Every ticket is encrypted with a unique single-use token. Once scanned at the door, the system marks the ticket as redeemed in real-time, preventing unauthorized duplicates.
              </p>
            </div>

            <div className="home-feature-card">
              <div className="home-feature-icon-box">
                <IconTicket style={{ width: '22px', height: '22px' }} />
              </div>
              <h3 className="home-feature-title">Centralized Ticket Wallet</h3>
              <p className="home-feature-desc">
                Never search through old screenshots again. Every ticket you purchase is backed up in your Eventora account wallet, accessible on any smartphone, tablet, or laptop.
              </p>
            </div>

            <div className="home-feature-card">
              <div className="home-feature-icon-box">
                <IconSmartphone style={{ width: '22px', height: '22px' }} />
              </div>
              <h3 className="home-feature-title">Live Camera Door Console</h3>
              <p className="home-feature-desc">
                Organizers can turn any device with a camera into an ultra-fast check-in scanner capable of processing hundreds of guests per hour without queues.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. ORGANIZER SPOTLIGHT (Clean Dark Solid Card, No Gradient) ── */}
      <section className="home-section">
        <div className="public-container">
          <div className="home-organizer-banner">
            <div className="home-organizer-info">
              <span className="home-organizer-kicker">FOR EVENT ORGANIZERS</span>
              <h2 className="home-organizer-title">
                Host your next event with Eventora.
              </h2>
              <p className="home-organizer-desc">
                From boutique workshops to 5,000-person festivals. Create multi-tier tickets, accept secure payments via PayHere, view real-time sales dashboards, and scan passes at the door.
              </p>

              <div className="home-organizer-perks">
                <div className="home-perk-item">
                  <IconCheck style={{ width: '16px', height: '16px', color: '#38bdf8' }} />
                  <span>Real-time ticket sales &amp; revenue charts</span>
                </div>
                <div className="home-perk-item">
                  <IconCheck style={{ width: '16px', height: '16px', color: '#38bdf8' }} />
                  <span>High-speed camera scanner door hub</span>
                </div>
                <div className="home-perk-item">
                  <IconCheck style={{ width: '16px', height: '16px', color: '#38bdf8' }} />
                  <span>Direct settlement to your local bank account</span>
                </div>
              </div>

              <div className="home-organizer-actions">
                <Link to="/account" className="btn btn-primary btn-lg" style={{ background: '#ffffff', color: '#0f172a', fontWeight: 700 }}>
                  Apply to Become an Organizer <IconArrowRight style={{ width: '16px', height: '16px' }} />
                </Link>
              </div>
            </div>

            <div className="home-organizer-metric-card">
              <div className="home-metric-row">
                <span className="home-metric-label">Door Check-in Speed</span>
                <strong className="home-metric-val">&lt; 1 Second</strong>
              </div>
              <div className="home-metric-row">
                <span className="home-metric-label">Currency Settlement</span>
                <strong className="home-metric-val">Sri Lankan Rupee (LKR)</strong>
              </div>
              <div className="home-metric-row">
                <span className="home-metric-label">Fraud Protection</span>
                <strong className="home-metric-val">100% Guaranteed</strong>
              </div>
              <div className="home-metric-footer">
                <span className="home-metric-badge">Powered by PayHere</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. FREQUENTLY ASKED QUESTIONS (FAQ) ── */}
      <section className="home-section home-faq-section">
        <div className="public-container">
          <div className="home-section-header">
            <span className="home-section-kicker">QUESTIONS &amp; ANSWERS</span>
            <h2 className="home-section-title">Frequently Asked Questions</h2>
            <p className="home-section-subtitle">
              Everything you need to know about registering, ticket delivery, and gate admission.
            </p>
          </div>

          <div className="home-faq-list">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openFaq === index
              return (
                <div key={index} className={`home-faq-item ${isOpen ? 'home-faq-item-open' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="home-faq-trigger"
                    aria-expanded={isOpen}
                  >
                    <span className="home-faq-question">{item.question}</span>
                    <span className="home-faq-icon">{isOpen ? '−' : '+'}</span>
                  </button>

                  {isOpen && (
                    <div className="home-faq-answer">
                      <p>{item.answer}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── 9. WEEKLY EVENT ALERTS / NEWSLETTER ── */}
      <section className="home-newsletter-section">
        <div className="public-container">
          <div className="home-newsletter-box">
            <div className="home-newsletter-info">
              <h3 className="home-newsletter-title">Stay in the loop with Colombo's best events</h3>
              <p className="home-newsletter-desc">
                Get handpicked weekend guides, early-bird ticket alerts, and exclusive access directly in your inbox. No spam, ever.
              </p>
            </div>

            {newsletterSubscribed ? (
              <div className="home-newsletter-success">
                <IconCheckCircle style={{ width: '20px', height: '20px', color: '#10b981' }} />
                <span>You're on the list! Check your inbox for the upcoming weekly guide.</span>
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit} className="home-newsletter-form">
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Enter your email address..."
                  className="home-newsletter-input"
                  aria-label="Email address for event alerts"
                />
                <button type="submit" className="btn btn-primary home-newsletter-btn">
                  Subscribe
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
