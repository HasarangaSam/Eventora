import { SignInButton, useAuth } from '@clerk/react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'

interface RegistrationStatus {
  id: string
  status: 'PENDING' | 'CONFIRMED' | 'EXPIRED'
  event: { id: string; title: string }
  ticketType: { id: string }
  payment: { id: string; status: 'INITIATED' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'CHARGEDBACK' } | null
}

type StatusState = { kind: 'loading' } | { kind: 'ready'; registration: RegistrationStatus } | { kind: 'error' }
type KeyedStatusState = { registrationId: string; refresh: number; result: StatusState }

export function CheckoutResultPage({ cancelled = false }: { cancelled?: boolean }) {
  const { isLoaded, isSignedIn } = useAuth()
  const request = useAuthenticatedApi()
  const [searchParams] = useSearchParams()
  const registrationId = searchParams.get('registrationId') ?? ''
  const [refresh, setRefresh] = useState(0)
  const [state, setState] = useState<KeyedStatusState>({ registrationId: '', refresh: -1, result: { kind: 'loading' } })

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !registrationId) return
    let active = true
    void request<RegistrationStatus>({ method: 'GET', url: `/registrations/${encodeURIComponent(registrationId)}` })
      .then(({ data }) => {
        if (!active) return
        if (data.status === 'CONFIRMED') {
          try { sessionStorage.removeItem(`eventora-checkout:${data.event.id}:${data.ticketType.id}`) } catch { /* Ignore unavailable browser storage. */ }
        }
        setState({ registrationId, refresh, result: { kind: 'ready', registration: data } })
      })
      .catch(() => { if (active) setState({ registrationId, refresh, result: { kind: 'error' } }) })
    return () => { active = false }
  }, [isLoaded, isSignedIn, registrationId, refresh, request])

  const view = state.registrationId === registrationId && state.refresh === refresh ? state.result : { kind: 'loading' as const }

  if (!isLoaded) return <main className="payment-result" aria-live="polite"><p>Checking your account…</p></main>
  if (!isSignedIn) return <main className="payment-result"><h1>Sign in to check your registration.</h1><SignInButton mode="modal"><button className="button button--dark" type="button">Sign in</button></SignInButton></main>
  if (!registrationId) return <main className="payment-result"><h1>Registration reference missing.</h1><Link to="/">Back to event discovery</Link></main>
  if (view.kind === 'loading') return <main className="payment-result" aria-live="polite"><p>Checking payment status with Eventora…</p></main>
  if (view.kind === 'error') return <main className="payment-result" role="alert"><h1>We couldn’t load this registration.</h1><p>Sign in with the account used to reserve the ticket, then try again.</p><button className="button button--dark" onClick={() => setRefresh((version) => version + 1)} type="button">Check again</button></main>

  const { registration } = view
  const paymentStatus = registration.payment?.status
  const confirmed = registration.status === 'CONFIRMED'
  const chargebackNeedsReview = paymentStatus === 'CHARGEDBACK'
  const successNeedsReview = !confirmed && paymentStatus === 'SUCCEEDED'
  const failed = paymentStatus === 'FAILED' && registration.status === 'PENDING'
  return <main className="payment-result" aria-live="polite">
    <span className="eyebrow">{cancelled ? 'Checkout returned' : 'Payment status'}</span>
    <h1>{chargebackNeedsReview ? 'PayHere reported a chargeback.' : confirmed ? 'Your registration is confirmed.' : successNeedsReview ? 'Payment received; registration needs review.' : failed ? 'PayHere did not complete this attempt.' : registration.status === 'EXPIRED' ? 'This reservation has expired.' : 'We’re waiting for PayHere’s confirmation.'}</h1>
    <p className="payment-result__event">{registration.event.title}</p>
    <p>{chargebackNeedsReview
      ? 'Eventora recorded PayHere’s chargeback notice for review. No automatic refund or inventory reversal was performed.'
      : confirmed
      ? 'Eventora confirmed this registration from PayHere’s server notification.'
      : successNeedsReview
        ? 'Eventora recorded a verified payment, but this registration was not confirmed. It has been recorded for administrative review.'
        : failed
          ? 'The registration hold remains active for its original ten-minute window. Return to the event page to retry checkout while the hold is valid.'
        : registration.status === 'EXPIRED'
          ? 'No ticket was issued for this expired reservation. If PayHere processed a payment, contact Eventora support with your registration reference.'
          : cancelled
            ? 'The browser returned from checkout. This does not confirm payment; check again after PayHere sends its server notification.'
            : `Current registration status: ${registration.status.toLowerCase()}; payment status: ${(paymentStatus ?? 'unknown').toLowerCase()}.`}</p>
    <p className="payment-result__reference">Registration reference: <code>{registration.id}</code></p>
    {!confirmed && <button className="button button--dark" type="button" onClick={() => setRefresh((version) => version + 1)}>Check status again</button>}
    {confirmed && <Link className="button button--dark" to="/tickets">View your tickets</Link>}
    <Link className="payment-result__back" to={`/events/${encodeURIComponent(registration.event.id)}`}>Back to event</Link>
  </main>
}
