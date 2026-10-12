import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../../lib/api'
import { type PublicEventCard } from '../events/event-card'
import { EventGrid } from '../events/event-grid'
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
    <div className="flex flex-col">
      {/* ── 1. HERO SECTION (Editorial, Clean, Solid Typography) ── */}
      <section className="relative pt-16 px-0 pb-[54px] bg-white border-b border-[var(--border)] max-[640px]:pt-10 max-[640px]:px-0 max-[640px]:pb-8">
        <div className="mx-auto w-full max-w-[1280px] px-6">
          <div className="grid [grid-template-columns:1.15fr_0.85fr] gap-14 items-center max-[1024px]:[grid-template-columns:1fr] max-[1024px]:gap-10">
            <div className="flex flex-col">
              <h1 className="text-[clamp(38px,_5vw,_60px)] font-black leading-[1.08] tracking-[-2px] text-slate-900 mt-0 mx-0 mb-5 max-[640px]:text-[32px]">
                Experiences worth leaving home for.
              </h1>

              <p className="text-lg leading-[1.65] text-slate-600 max-w-[560px] mt-0 mx-0 mb-8">
                The trusted platform for discovering conferences, concerts, and workshops.
                Instant registration, secure PayHere payments, and verified QR passes delivered straight to your email.
              </p>

              {/* Direct Search Form */}
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-3 bg-white border-[1.5px] border-slate-300 rounded-[var(--radius-lg)] pt-1.5 pr-1.5 pb-1.5 pl-4 shadow-[0_4px_12px_rgba(15,_23,_42,_0.06)] max-w-[580px] mb-5 [transition:all_0.2s_ease] focus-within:border-[var(--primary)] focus-within:shadow-[0_0_0_3px_rgba(99,_102,_241,_0.15),_0_4px_14px_rgba(15,_23,_42,_0.08)] max-[640px]:flex-col max-[640px]:p-2.5 max-[640px]:gap-2">
                <div className="flex items-center gap-2.5 [flex:1]">
                  <IconSearch className="w-5 h-5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search events by title, artist, or venue..."
                    className="w-full border-0 [outline:none] text-[15px] text-slate-900 bg-[transparent] [&::placeholder]:text-slate-400"
                    aria-label="Search events"
                  />
                </div>
                <button type="submit" className="bg-indigo-600 text-white border-0 rounded-[var(--radius-md)] py-3 px-6 text-sm font-bold cursor-pointer [transition:background_0.15s_ease] whitespace-nowrap hover:bg-indigo-700 max-[640px]:w-full">
                  Explore Events
                </button>
              </form>

              {/* Functional Category Filter Links (dynamically loaded from API) */}
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-[13px] font-semibold text-slate-500 mr-1">Popular:</span>
                {categories.length > 0 ? (
                  categories.slice(0, 4).map((cat) => (
                    <Link key={cat.id} to={`/discover?categoryId=${cat.id}`} className="text-[13px] font-semibold text-slate-700 bg-slate-100 py-1.5 px-3.5 rounded-[var(--radius-full)] no-underline [transition:all_0.15s_ease] hover:bg-slate-200 hover:text-slate-900">
                      {cat.name}
                    </Link>
                  ))
                ) : (
                  <>
                    <Link to="/discover?search=Tech" className="text-[13px] font-semibold text-slate-700 bg-slate-100 py-1.5 px-3.5 rounded-[var(--radius-full)] no-underline [transition:all_0.15s_ease] hover:bg-slate-200 hover:text-slate-900">Technology</Link>
                    <Link to="/discover?search=Music" className="text-[13px] font-semibold text-slate-700 bg-slate-100 py-1.5 px-3.5 rounded-[var(--radius-full)] no-underline [transition:all_0.15s_ease] hover:bg-slate-200 hover:text-slate-900">Concerts</Link>
                    <Link to="/discover?search=Workshop" className="text-[13px] font-semibold text-slate-700 bg-slate-100 py-1.5 px-3.5 rounded-[var(--radius-full)] no-underline [transition:all_0.15s_ease] hover:bg-slate-200 hover:text-slate-900">Workshops</Link>
                  </>
                )}
                <Link to="/discover" className="text-[13px] font-semibold text-slate-700 bg-slate-100 py-1.5 px-3.5 rounded-[var(--radius-full)] no-underline [transition:all_0.15s_ease] hover:bg-slate-200 hover:text-slate-900 text-indigo-600 bg-[#eef2ff] hover:bg-indigo-100">All Events →</Link>
              </div>
            </div>

            {/* Hero Visual Card */}
            <div className="relative">
              <div className="relative rounded-[20px] overflow-hidden shadow-[0_20px_35px_-10px_rgba(15,_23,_42,_0.15)] border aspect-[4_/_3]">
                <img
                  src={PLACEHOLDER_IMAGES.hero}
                  alt="Live festival and convention gathering"
                  className="w-full h-full object-cover block"
                />
                <div className="absolute bottom-[0] left-[0] right-[0] bg-[rgba(15,_23,_42,_0.85)] backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)] text-white py-3.5 px-5 flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                    <IconMapPin style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                    <span>Colombo & Island-wide Venues</span>
                  </div>
                  <span className="font-bold text-[#38bdf8] text-xs tracking-[0.3px]">100% Verified Entry</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. TRUST & ASSURANCE STRIP ── */}
      <section className="bg-white border-b border-[var(--border)] py-8 px-0">
        <div className="mx-auto w-full max-w-[1280px] px-6">
          <div className="grid [grid-template-columns:repeat(4,_1fr)] gap-6 max-[1024px]:[grid-template-columns:repeat(2,_1fr)] max-[640px]:[grid-template-columns:1fr]">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-[10px] bg-slate-100 text-indigo-600 flex items-center justify-center shrink-0">
                <IconMail style={{ width: '20px', height: '20px' }} />
              </div>
              <div>
                <strong className="block text-sm font-bold text-slate-900 mb-1">Instant Email Delivery</strong>
                <p className="m-0 text-[13px] leading-[1.5] text-slate-500">Tickets arrive in your inbox the second payment confirms.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-[10px] bg-slate-100 text-indigo-600 flex items-center justify-center shrink-0">
                <IconQrCode style={{ width: '20px', height: '20px' }} />
              </div>
              <div>
                <strong className="block text-sm font-bold text-slate-900 mb-1">Encrypted QR Tickets</strong>
                <p className="m-0 text-[13px] leading-[1.5] text-slate-500">Single-use, anti-counterfeit codes scanned at the door.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-[10px] bg-slate-100 text-indigo-600 flex items-center justify-center shrink-0">
                <IconCreditCard style={{ width: '20px', height: '20px' }} />
              </div>
              <div>
                <strong className="block text-sm font-bold text-slate-900 mb-1">PayHere Checkout</strong>
                <p className="m-0 text-[13px] leading-[1.5] text-slate-500">Official Sri Lankan gateway for all cards and local payments.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-[10px] bg-slate-100 text-indigo-600 flex items-center justify-center shrink-0">
                <IconSmartphone style={{ width: '20px', height: '20px' }} />
              </div>
              <div>
                <strong className="block text-sm font-bold text-slate-900 mb-1">No Printing Needed</strong>
                <p className="m-0 text-[13px] leading-[1.5] text-slate-500">Flash your phone screen at the entrance for &lt;1s admission.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. HOW IT WORKS: REGISTRATION, EMAIL & QR CODE EXPERIENCE ── */}
      <section className="py-[72px] px-0 border-b border-[var(--border)] bg-slate-50">
        <div className="mx-auto w-full max-w-[1280px] px-6">
          <div className="mb-10">
            <span className="inline-block text-xs font-extrabold tracking-[1.5px] text-indigo-600 mb-2 uppercase">STEP-BY-STEP PROCESS</span>
            <h2 className="mt-0 mx-0 mb-2.5 text-[clamp(28px,_3.5vw,_36px)] font-extrabold tracking-[-0.8px] text-slate-900">How Eventora Works</h2>
            <p className="m-0 text-base text-slate-500 max-w-[600px] leading-[1.6]">
              From choosing your seat to walking through the venue doors — simple, paperless, and completely secure.
            </p>
          </div>

          <div className="grid [grid-template-columns:1.15fr_0.85fr] gap-12 items-start max-[1024px]:[grid-template-columns:1fr] max-[1024px]:gap-10">
            {/* The 4 Steps */}
            <div className="flex flex-col gap-5">
              <div className="flex gap-[18px] bg-white border border-slate-200 rounded-[14px] p-6 [transition:all_0.2s_ease] shadow-[0_1px_3px_rgba(0,_0,_0,_0.04)] hover:border-slate-300 hover:shadow-[0_4px_12px_rgba(15,_23,_42,_0.06)] hover:-translate-y-px max-[640px]:py-[18px] max-[640px]:px-4">
                <div className="w-[38px] h-[38px] rounded-[10px] bg-slate-900 text-white text-base font-extrabold flex items-center justify-center shrink-0">1</div>
                <div className="[flex:1]">
                  <h3 className="mt-0 mx-0 mb-1.5 text-[17px] font-bold text-slate-900">Choose Your Event &amp; Ticket Tier</h3>
                  <p className="m-0 text-sm leading-[1.6] text-slate-600">
                    Browse verified live experiences, summits, and performances. Select your preferred tier (General Admission, VIP, or Early Bird) with upfront pricing and live seat availability.
                  </p>
                </div>
              </div>

              <div className="flex gap-[18px] bg-white border border-slate-200 rounded-[14px] p-6 [transition:all_0.2s_ease] shadow-[0_1px_3px_rgba(0,_0,_0,_0.04)] hover:border-slate-300 hover:shadow-[0_4px_12px_rgba(15,_23,_42,_0.06)] hover:-translate-y-px max-[640px]:py-[18px] max-[640px]:px-4">
                <div className="w-[38px] h-[38px] rounded-[10px] bg-slate-900 text-white text-base font-extrabold flex items-center justify-center shrink-0">2</div>
                <div className="[flex:1]">
                  <h3 className="mt-0 mx-0 mb-1.5 text-[17px] font-bold text-slate-900">1-Click Registration &amp; Secure Payment</h3>
                  <p className="m-0 text-sm leading-[1.6] text-slate-600">
                    Register or sign in with your account. Complete your purchase in seconds via PayHere with Visa, Mastercard, AMEX, or local payment channels in Sri Lankan Rupees.
                  </p>
                </div>
              </div>

              <div className="flex gap-[18px] bg-white border border-slate-200 rounded-[14px] p-6 [transition:all_0.2s_ease] shadow-[0_1px_3px_rgba(0,_0,_0,_0.04)] hover:border-slate-300 hover:shadow-[0_4px_12px_rgba(15,_23,_42,_0.06)] hover:-translate-y-px max-[640px]:py-[18px] max-[640px]:px-4">
                <div className="w-[38px] h-[38px] rounded-[10px] bg-slate-900 text-white text-base font-extrabold flex items-center justify-center shrink-0">3</div>
                <div className="[flex:1]">
                  <h3 className="mt-0 mx-0 mb-1.5 text-[17px] font-bold text-slate-900">Instant Email Confirmation with QR Pass</h3>
                  <p className="m-0 text-sm leading-[1.6] text-slate-600">
                    The second payment completes, an official confirmation email arrives in your inbox containing your verified digital ticket pass with an anti-counterfeit QR code.
                  </p>
                </div>
              </div>

              <div className="flex gap-[18px] bg-white border border-slate-200 rounded-[14px] p-6 [transition:all_0.2s_ease] shadow-[0_1px_3px_rgba(0,_0,_0,_0.04)] hover:border-slate-300 hover:shadow-[0_4px_12px_rgba(15,_23,_42,_0.06)] hover:-translate-y-px max-[640px]:py-[18px] max-[640px]:px-4">
                <div className="w-[38px] h-[38px] rounded-[10px] bg-slate-900 text-white text-base font-extrabold flex items-center justify-center shrink-0">4</div>
                <div className="[flex:1]">
                  <h3 className="mt-0 mx-0 mb-1.5 text-[17px] font-bold text-slate-900">Scan at the Door &amp; Walk Straight In</h3>
                  <p className="m-0 text-sm leading-[1.6] text-slate-600">
                    Arrive at the event, open the email or ticket pass on your phone, and let the door team scan your QR code with their live door console. You’re admitted in under one second.
                  </p>
                </div>
              </div>
            </div>

            {/* Visual Interactive Mockup: Email & QR Ticket Pass Preview */}
            <div>
              <div className="bg-white border border-slate-300 rounded-[20px] shadow-[0_12px_30px_-8px_rgba(15,_23,_42,_0.12)] overflow-hidden">
                <div className="bg-slate-900 text-white py-4 px-5 border-b border-slate-800">
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="w-2 h-2 rounded-[50%]" style={{ background: '#ef4444' }} />
                    <span className="w-2 h-2 rounded-[50%]" style={{ background: '#f59e0b' }} />
                    <span className="w-2 h-2 rounded-[50%]" style={{ background: '#10b981' }} />
                    <span className="ml-1.5 text-xs text-slate-400 [font-family:monospace]">Inbox · tickets@eventora.lk</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="inline-block bg-emerald-500 text-white text-[11px] font-extrabold py-0.5 px-2 rounded-[var(--radius-full)] w-fit uppercase tracking-[0.5px] mb-0.5">Delivered Instantly</span>
                    <strong className="text-[15px] font-bold text-white leading-[1.3]">Your Tickets for Colombo Tech Summit 2026</strong>
                    <span className="text-xs text-slate-300">Sent to: sarah.mendis@example.com</span>
                  </div>
                </div>

                {/* The Ticket Pass */}
                <div className="pt-6 px-5 pb-5 bg-slate-50">
                  <div className="flex justify-between items-start mb-[18px]">
                    <div>
                      <span className="inline-block bg-slate-900 text-white text-[11px] font-extrabold py-[3px] px-2 rounded-[var(--radius-sm)] tracking-[0.5px] mb-1.5">VIP ALL-ACCESS</span>
                      <h4 className="mt-0 mx-0 mb-1 text-lg font-extrabold text-slate-900">Colombo Tech Summit 2026</h4>
                      <span className="text-[13px] text-slate-500 font-medium">Sat, Nov 21 · 09:00 AM · Nelum Pokuna</span>
                    </div>
                    <div className="text-lg font-black text-slate-900 tracking-[-0.5px] [&_span]:text-indigo-600">
                      eventora<span>.</span>
                    </div>
                  </div>

                  <div className="relative my-[18px] mx--5 h-5 flex items-center">
                    <div className="w-3.5 h-6 bg-white absolute top-[-2px] left-[0] [border-top-right-radius:12px] [border-bottom-right-radius:12px] border border-slate-300 border-0" />
                    <div className="w-full border-t-[2px] border-dashed border-slate-300 my-0 mx-4" />
                    <div className="w-3.5 h-6 bg-white absolute top-[-2px] right-[0] [border-top-left-radius:12px] [border-bottom-left-radius:12px] border border-slate-300 border-0" />
                  </div>

                  <div className="flex justify-between items-center gap-4 mb-4">
                    <div className="flex flex-col gap-2.5">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-extrabold text-slate-400 tracking-[0.5px]">ATTENDEE</span>
                        <strong className="text-[13px] font-bold text-slate-900">Sarah Mendis</strong>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-extrabold text-slate-400 tracking-[0.5px]">SEAT / TIER</span>
                        <strong className="text-[13px] font-bold text-slate-900">Section A · VIP Row 3</strong>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-extrabold text-slate-400 tracking-[0.5px]">TICKET REFERENCE</span>
                        <strong className="text-[13px] font-bold text-slate-900">#EVT-8942-LK</strong>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-1.5 bg-white p-3 rounded-[12px] border-[1.5px] border-slate-200">
                      <div className="flex items-center justify-center" aria-label="Sample QR Code">
                        <IconQrCode style={{ width: '72px', height: '72px', color: '#0f172a' }} />
                      </div>
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.3px]">Scan at entrance</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3.5 border-t border-slate-200 text-xs font-semibold text-slate-600">
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
      <section className="py-[72px] px-0 border-b border-[var(--border)]">
        <div className="mx-auto w-full max-w-[1280px] px-6">
          <div className="mb-10 flex justify-between items-end max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-3">
            <div>
              <h2 className="mt-0 mx-0 mb-2.5 text-[clamp(28px,_3.5vw,_36px)] font-extrabold tracking-[-0.8px] text-slate-900">Upcoming Events</h2>
              <p className="m-0 text-base text-slate-500 max-w-[600px] leading-[1.6]">
                Handpicked conferences, concerts, and workshops happening soon.
              </p>
            </div>
            <Link to="/discover" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)] inline-flex items-center gap-2 text-sm font-semibold whitespace-nowrap">
              View All Events <IconArrowRight style={{ width: '15px', height: '15px' }} />
            </Link>
          </div>

          {eventsState === 'loading' ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-7">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[360px] animate-pulse overflow-hidden rounded-2xl border border-[var(--border)] bg-slate-100 shadow-[var(--shadow-sm)] [animation-duration:1.5s]" />
              ))}
            </div>
          ) : eventsState === 'error' ? (
            <div className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ padding: '36px', textAlign: 'center' }}>
              <p className="text-muted">Could not load featured events.</p>
              <Link to="/discover" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px] [--button-px:12px] [--button-py:6px] [--button-font-size:13px] [--button-radius:var(--radius-sm)] text-[13px]">
                Browse Discovery Directory
              </Link>
            </div>
          ) : events.length ? (
            <EventGrid events={events} />
          ) : (
            <div className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No published events available right now. Check back soon!
            </div>
          )}
        </div>
      </section>

      {/* ── 5. BROWSE BY CATEGORY ── */}
      {categories.length > 0 && (
        <section className="py-[72px] px-0 border-b border-[var(--border)] bg-white">
          <div className="mx-auto w-full max-w-[1280px] px-6">
            <div className="mb-10">
              <h2 className="mt-0 mx-0 mb-2.5 text-[clamp(28px,_3.5vw,_36px)] font-extrabold tracking-[-0.8px] text-slate-900">Explore by Category</h2>
              <p className="m-0 text-base text-slate-500 max-w-[600px] leading-[1.6]">
                Find experiences tailored to your passions and interests.
              </p>
            </div>

            <div className="grid [grid-template-columns:repeat(auto-fill,_minmax(180px,_1fr))] gap-4">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  to={`/discover?categoryId=${encodeURIComponent(category.id)}`}
                  className="bg-slate-50 border border-slate-200 rounded-[14px] py-5 px-[18px] no-underline flex flex-col gap-2 [transition:all_0.2s_ease] hover:bg-white hover:border-slate-300 hover:shadow-[0_4px_12px_rgba(15,_23,_42,_0.06)] hover:-translate-y-0.5"
                >
                  <div className="w-10 h-10 rounded-[10px] bg-[#eef2ff] text-indigo-600 flex items-center justify-center">
                    <IconTicket style={{ width: '22px', height: '22px' }} />
                  </div>
                  <strong className="text-[15px] font-bold text-slate-900">{category.name}</strong>
                  <span className="text-xs font-semibold text-indigo-600">Browse events →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 6. WHY EVENTORA / PLATFORM INTEGRITY ── */}
      <section className="py-[72px] px-0 border-b border-[var(--border)] bg-slate-50">
        <div className="mx-auto w-full max-w-[1280px] px-6">
          <div className="mb-10">
            <span className="inline-block text-xs font-extrabold tracking-[1.5px] text-indigo-600 mb-2 uppercase">BUILT FOR RELIABILITY</span>
            <h2 className="mt-0 mx-0 mb-2.5 text-[clamp(28px,_3.5vw,_36px)] font-extrabold tracking-[-0.8px] text-slate-900">Why Eventora Stands Apart</h2>
            <p className="m-0 text-base text-slate-500 max-w-[600px] leading-[1.6]">
              Engineered from the ground up for seamless attendee experiences and ironclad organizer operations.
            </p>
          </div>

          <div className="grid [grid-template-columns:repeat(3,_1fr)] gap-7 max-[1024px]:[grid-template-columns:1fr]">
            <div className="bg-white border border-slate-200 rounded-[16px] py-8 px-6 shadow-[0_1px_3px_rgba(0,_0,_0,_0.04)]">
              <div className="w-12 h-12 rounded-[12px] bg-slate-900 text-white flex items-center justify-center mb-5">
                <IconShield style={{ width: '22px', height: '22px' }} />
              </div>
              <h3 className="mt-0 mx-0 mb-2.5 text-lg font-bold text-slate-900">Anti-Counterfeit QR Security</h3>
              <p className="m-0 text-sm leading-[1.65] text-slate-600">
                Every ticket is encrypted with a unique single-use token. Once scanned at the door, the system marks the ticket as redeemed in real-time, preventing unauthorized duplicates.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-[16px] py-8 px-6 shadow-[0_1px_3px_rgba(0,_0,_0,_0.04)]">
              <div className="w-12 h-12 rounded-[12px] bg-slate-900 text-white flex items-center justify-center mb-5">
                <IconTicket style={{ width: '22px', height: '22px' }} />
              </div>
              <h3 className="mt-0 mx-0 mb-2.5 text-lg font-bold text-slate-900">Centralized Ticket Wallet</h3>
              <p className="m-0 text-sm leading-[1.65] text-slate-600">
                Never search through old screenshots again. Every ticket you purchase is backed up in your Eventora account wallet, accessible on any smartphone, tablet, or laptop.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-[16px] py-8 px-6 shadow-[0_1px_3px_rgba(0,_0,_0,_0.04)]">
              <div className="w-12 h-12 rounded-[12px] bg-slate-900 text-white flex items-center justify-center mb-5">
                <IconSmartphone style={{ width: '22px', height: '22px' }} />
              </div>
              <h3 className="mt-0 mx-0 mb-2.5 text-lg font-bold text-slate-900">Live Camera Door Console</h3>
              <p className="m-0 text-sm leading-[1.65] text-slate-600">
                Organizers can turn any device with a camera into an ultra-fast check-in scanner capable of processing hundreds of guests per hour without queues.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. ORGANIZER SPOTLIGHT (Clean Dark Solid Card, No Gradient) ── */}
      <section className="py-[72px] px-0 border-b border-[var(--border)]">
        <div className="mx-auto w-full max-w-[1280px] px-6">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-[24px] py-[60px] px-[52px] grid [grid-template-columns:1.2fr_0.8fr] gap-12 items-center shadow-[0_25px_40px_-15px_rgba(11,_15,_25,_0.4)] max-[1024px]:[grid-template-columns:1fr] max-[1024px]:gap-10 max-[640px]:py-8 max-[640px]:px-5">
            <div className="flex flex-col">
              <span className="text-[11px] font-extrabold tracking-[1.5px] text-[#38bdf8] mb-2.5 uppercase">FOR EVENT ORGANIZERS</span>
              <h2 className="mt-0 mx-0 mb-3.5 text-[clamp(28px,_3.5vw,_40px)] font-black text-white leading-[1.15] tracking-[-0.8px]">
                Host your next event with Eventora.
              </h2>
              <p className="mt-0 mx-0 mb-6 text-base leading-[1.65] text-slate-400 max-w-[540px]">
                From boutique workshops to 5,000-person festivals. Create multi-tier tickets, accept secure payments via PayHere, view real-time sales dashboards, and scan passes at the door.
              </p>

              <div className="flex flex-col gap-3 mb-8">
                <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-200">
                  <IconCheck style={{ width: '16px', height: '16px', color: '#38bdf8' }} />
                  <span>Real-time ticket sales &amp; revenue charts</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-200">
                  <IconCheck style={{ width: '16px', height: '16px', color: '#38bdf8' }} />
                  <span>High-speed camera scanner door hub</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-200">
                  <IconCheck style={{ width: '16px', height: '16px', color: '#38bdf8' }} />
                  <span>Direct settlement to your local bank account</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Link to="/account" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px] [--button-px:26px] [--button-py:14px] [--button-font-size:16px] [--button-radius:var(--radius-lg)] text-base" style={{ background: '#ffffff', color: '#0f172a', fontWeight: 700 }}>
                  Apply to Become an Organizer <IconArrowRight style={{ width: '16px', height: '16px' }} />
                </Link>
              </div>
            </div>

            <div className="bg-[#111827] border rounded-[18px] py-8 px-7 flex flex-col gap-[18px]">
              <div className="flex flex-col gap-1 pb-3.5 border-b [&:last-of-type]:border-b-0 [&:last-of-type]:pb-0">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-[0.5px]">Door Check-in Speed</span>
                <strong className="text-xl font-extrabold text-white">&lt; 1 Second</strong>
              </div>
              <div className="flex flex-col gap-1 pb-3.5 border-b [&:last-of-type]:border-b-0 [&:last-of-type]:pb-0">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-[0.5px]">Currency Settlement</span>
                <strong className="text-xl font-extrabold text-white">Sri Lankan Rupee (LKR)</strong>
              </div>
              <div className="flex flex-col gap-1 pb-3.5 border-b [&:last-of-type]:border-b-0 [&:last-of-type]:pb-0">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-[0.5px]">Fraud Protection</span>
                <strong className="text-xl font-extrabold text-white">100% Guaranteed</strong>
              </div>
              <div className="pt-2.5 flex items-center">
                <span className="inline-block bg-[rgba(56,_189,_248,_0.15)] text-[#38bdf8] border text-xs font-bold py-1 px-3 rounded-[var(--radius-full)]">Powered by PayHere</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. FREQUENTLY ASKED QUESTIONS (FAQ) ── */}
      <section className="py-[72px] px-0 border-b border-[var(--border)] bg-white">
        <div className="mx-auto w-full max-w-[1280px] px-6">
          <div className="mb-10">
            <span className="inline-block text-xs font-extrabold tracking-[1.5px] text-indigo-600 mb-2 uppercase">QUESTIONS &amp; ANSWERS</span>
            <h2 className="mt-0 mx-0 mb-2.5 text-[clamp(28px,_3.5vw,_36px)] font-extrabold tracking-[-0.8px] text-slate-900">Frequently Asked Questions</h2>
            <p className="m-0 text-base text-slate-500 max-w-[600px] leading-[1.6]">
              Everything you need to know about registering, ticket delivery, and gate admission.
            </p>
          </div>

          <div className="max-w-[820px] my-0 mx-auto flex flex-col gap-3.5">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openFaq === index
              return (
                <div key={index} className={`border-[1.5px] border-slate-200 rounded-[14px] overflow-hidden transition-[all] duration-[180ms] bg-white hover:border-slate-300 ${isOpen ? 'border-indigo-600 shadow-[0_4px_12px_rgba(79,_70,_229,_0.08)]' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full flex justify-between items-center py-5 px-6 bg-[transparent] border-0 cursor-pointer text-left gap-4"
                    aria-expanded={isOpen}
                  >
                    <span className="text-base font-bold text-slate-900">{item.question}</span>
                    <span className="text-[22px] font-semibold text-indigo-600 leading-[1] shrink-0">{isOpen ? '−' : '+'}</span>
                  </button>

                  {isOpen && (
                    <div className="pt-0 px-6 pb-5 border-t border-slate-100 [&_p]:mt-3 [&_p]:mx-0 [&_p]:mb-0 [&_p]:text-[15px] [&_p]:leading-[1.65] [&_p]:text-slate-600">
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
      <section className="bg-slate-50 pt-[60px] px-0 pb-20">
        <div className="mx-auto w-full max-w-[1280px] px-6">
          <div className="bg-white border-[1.5px] border-slate-200 rounded-[20px] py-11 px-12 flex items-center justify-between gap-9 shadow-[0_4px_20px_rgba(15,_23,_42,_0.04)] max-[1024px]:flex-col max-[1024px]:items-start max-[1024px]:py-8 max-[1024px]:px-6">
            <div className="max-w-[520px]">
              <h3 className="mt-0 mx-0 mb-2 text-2xl font-extrabold text-slate-900 tracking-[-0.5px]">Stay in the loop with Colombo's best events</h3>
              <p className="m-0 text-[15px] leading-[1.6] text-slate-500">
                Get handpicked weekend guides, early-bird ticket alerts, and exclusive access directly in your inbox. No spam, ever.
              </p>
            </div>

            {newsletterSubscribed ? (
              <div className="flex items-center gap-2.5 text-sm font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 py-3 px-5 rounded-[10px]">
                <IconCheckCircle style={{ width: '20px', height: '20px', color: '#10b981' }} />
                <span>You're on the list! Check your inbox for the upcoming weekly guide.</span>
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit} className="flex items-center gap-2.5 [flex:1] max-w-[440px] max-[1024px]:w-full max-[1024px]:max-w-full">
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Enter your email address..."
                  className="[flex:1] py-3 px-4 border-[1.5px] border-slate-300 rounded-[var(--radius-md)] text-sm text-slate-900 bg-slate-50 [outline:none] [transition:all_0.15s_ease] focus:border-indigo-600 focus:bg-white focus:shadow-[0_0_0_3px_rgba(79,_70,_229,_0.12)]"
                  aria-label="Email address for event alerts"
                />
                <button type="submit" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px] whitespace-nowrap py-3 px-[22px] font-bold">
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
