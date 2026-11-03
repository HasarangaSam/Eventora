import { SignInButton, useAuth } from '@clerk/react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { IconCheck, IconClock, IconTicket } from '../../components/ui/icons'

interface RegistrationStatus {
  id: string
  status: 'PENDING' | 'CONFIRMED' | 'EXPIRED'
  event: { id: string; title: string; status?: string; cancellationReason?: string | null }
  ticketType: { id: string }
  payment: { id: string; status: 'INITIATED' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'CHARGEDBACK' } | null
  reservation: { status: string; expiresAt: string } | null
}

type StatusState = { kind: 'loading' } | { kind: 'ready'; registration: RegistrationStatus } | { kind: 'error' }

export function CheckoutResultPage({ cancelled = false }: { cancelled?: boolean }) {
  const { isLoaded, isSignedIn } = useAuth()
  const request = useAuthenticatedApi()
  const [searchParams] = useSearchParams()
  const registrationId = searchParams.get('registrationId') ?? ''
  const [refresh, setRefresh] = useState(0)
  const [state, setState] = useState<StatusState>({ kind: 'loading' })
  const [pollCount, setPollCount] = useState(0)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !registrationId) return
    let active = true

    async function loadRegistrationStatus() {
      try {
        const { data } = await request<RegistrationStatus>({ method: 'GET', url: `/registrations/${encodeURIComponent(registrationId)}` })
        if (!active) return
        if (data.status === 'CONFIRMED') {
          try {
            sessionStorage.removeItem(`eventora-checkout:${data.event.id}:${data.ticketType.id}`)
          } catch {}
        }
        setState({ kind: 'ready', registration: data })
      } catch {
        if (active) setState({ kind: 'error' })
      }
    }
    void loadRegistrationStatus()

    return () => {
      active = false
    }
  }, [isLoaded, isSignedIn, registrationId, refresh, request])

  useEffect(() => {
    if (state.kind !== 'ready' || state.registration.status !== 'PENDING' || pollCount >= 8) return
    const timer = window.setTimeout(() => { setPollCount((value) => value + 1); setRefresh((value) => value + 1) }, 4000)
    return () => window.clearTimeout(timer)
  }, [pollCount, state])

  if (!isLoaded || state.kind === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-[var(--text-muted)] font-medium">
        <div className="h-8 w-8 rounded-full border-[3px] border-[rgba(99,102,241,0.2)] border-t-[var(--primary)] animate-[spin_0.8s_linear_infinite]" />
        <p>Verifying payment settlement with Eventora…</p>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-[var(--text-muted)] font-medium">
        <h2>Sign in to check registration status</h2>
        <SignInButton mode="modal">
          <button type="button" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px]">Sign In</button>
        </SignInButton>
      </div>
    )
  }

  if (!registrationId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-[var(--text-muted)] font-medium">
        <h2>No registration reference provided</h2>
        <Link to="/discover" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)]">Explore Events</Link>
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-[var(--text-muted)] font-medium">
        <h2>Could not retrieve registration record</h2>
        <button type="button" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)]" onClick={() => setRefresh((v) => v + 1)}>
          Check Again
        </button>
      </div>
    )
  }

  const { registration } = state
  const paymentStatus = registration.payment?.status
  const confirmed = registration.status === 'CONFIRMED'
  const paymentFailed = paymentStatus === 'FAILED' || paymentStatus === 'CHARGEDBACK'
  const reservationExpired = registration.status === 'EXPIRED' || registration.reservation?.status === 'EXPIRED'
  const paidButNotConfirmed = paymentStatus === 'SUCCEEDED' && !confirmed
  const eventCancelled = registration.event.status === 'CANCELLED'
  const statusTitle = confirmed ? 'Your booking is confirmed' : paidButNotConfirmed ? 'Payment received; ticket needs review' : paymentFailed ? 'Payment was not completed' : reservationExpired ? 'Reservation expired' : cancelled ? 'Checkout was cancelled' : 'Payment is still processing'

  return (
    <main className="mx-auto flex w-full max-w-[1280px] justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div
        className="mb-8 w-full max-w-[560px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-5 text-center shadow-[var(--shadow-lg)] sm:p-10"
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: confirmed ? 'var(--success-bg)' : 'var(--warning-bg)',
            color: confirmed ? 'var(--success)' : 'var(--warning)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          {confirmed ? <IconCheck style={{ width: '32px', height: '32px' }} /> : <IconClock style={{ width: '32px', height: '32px' }} />}
        </div>

        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none capitalize ${confirmed ? "border border-[#a7f3d0] bg-[#ecfdf5] text-[#059669] [--badge-dot-color:#10b981]" : "border border-[#fde68a] bg-[#fffbeb] text-[#d97706] [--badge-dot-color:#f59e0b]"}`} style={{ marginBottom: '12px' }}>
          {confirmed ? 'Booking confirmed' : paidButNotConfirmed ? 'Action may be needed' : paymentFailed ? 'Payment failed' : reservationExpired ? 'Hold expired' : cancelled ? 'Checkout returned' : 'Processing'}
        </span>

        <h1 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 800 }}>
          {statusTitle}
        </h1>

        <p style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600, color: 'var(--primary)' }}>
          {registration.event.title}
        </p>

        <p className="text-muted" style={{ margin: '0 0 24px', fontSize: '14px', lineHeight: 1.6 }}>
          {confirmed
            ? eventCancelled ? `Your booking was confirmed, but this event has since been cancelled${registration.event.cancellationReason ? `: ${registration.event.cancellationReason}` : '.'} Review your booking history for the event status.` : 'PayHere confirmed your payment. Your pass is ready in your Ticket Wallet.'
            : paidButNotConfirmed ? 'The payment provider confirmed a payment, but Eventora could not confirm a ticket for this booking. Keep this registration reference and check your order history for updates.'
              : paymentFailed ? reservationExpired ? 'The payment did not complete and the ticket hold expired. Return to the event page to check whether tickets are still available and start a new booking.' : 'The payment did not complete. Your ticket hold remains active until the time shown in your order; return to the event page to retry checkout.'
                : reservationExpired ? 'The ticket hold expired before payment was confirmed. No ticket was issued. You can return to the event page and book again if tickets are still available.'
                  : 'Eventora is waiting for PayHere to confirm the payment. This page checks again automatically for a short time; you can also refresh the status or return later to your order history.'}
        </p>

        <div
          style={{
            background: '#f8fafc',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            marginBottom: '28px',
            fontSize: '13px',
          }}
        >
          Registration Reference: <code className="break-all">{registration.id}</code>
          {paymentStatus && <span className="text-muted"> · Payment: {paymentStatus.toLowerCase()}</span>}
          {registration.reservation && registration.status === 'PENDING' && <span className="block text-muted"> · Ticket hold expires {new Date(registration.reservation.expiresAt).toLocaleTimeString()}</span>}
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {confirmed ? (
            <Link to="/tickets" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px]" style={{ padding: '12px 24px' }}>
              <IconTicket /> View Digital Passes
            </Link>
          ) : !paidButNotConfirmed ? (
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)]"
              onClick={() => { setPollCount(0); setRefresh((v) => v + 1) }}
            >
              Refresh Status
            </button>
          ) : null}

          <Link to="/account" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)]">
            View order history
          </Link>
        </div>
      </div>
    </main>
  )
}
