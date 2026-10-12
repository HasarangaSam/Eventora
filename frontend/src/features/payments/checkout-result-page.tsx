import { SignInButton, useAuth } from '@clerk/react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { IconCheck, IconClock, IconTicket } from '../../components/ui/icons'

interface RegistrationStatus {
  id: string
  status: 'PENDING' | 'CONFIRMED' | 'EXPIRED'
  event: { id: string; title: string }
  ticketType: { id: string }
  payment: { id: string; status: 'INITIATED' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'CHARGEDBACK' } | null
}

type StatusState = { kind: 'loading' } | { kind: 'ready'; registration: RegistrationStatus } | { kind: 'error' }

export function CheckoutResultPage({ cancelled = false }: { cancelled?: boolean }) {
  const { isLoaded, isSignedIn } = useAuth()
  const request = useAuthenticatedApi()
  const [searchParams] = useSearchParams()
  const registrationId = searchParams.get('registrationId') ?? ''
  const [refresh, setRefresh] = useState(0)
  const [state, setState] = useState<StatusState>({ kind: 'loading' })

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !registrationId) return
    let active = true

    request<RegistrationStatus>({ method: 'GET', url: `/registrations/${encodeURIComponent(registrationId)}` })
      .then(({ data }) => {
        if (!active) return
        if (data.status === 'CONFIRMED') {
          try {
            sessionStorage.removeItem(`eventora-checkout:${data.event.id}:${data.ticketType.id}`)
          } catch {}
        }
        setState({ kind: 'ready', registration: data })
      })
      .catch(() => {
        if (active) setState({ kind: 'error' })
      })

    return () => {
      active = false
    }
  }, [isLoaded, isSignedIn, registrationId, refresh, request])

  if (!isLoaded || state.kind === 'loading') {
    return (
      <div className="fullscreen-loading">
        <div className="spinner" />
        <p>Verifying payment settlement with Eventora…</p>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="fullscreen-loading">
        <h2>Sign in to check registration status</h2>
        <SignInButton mode="modal">
          <button type="button" className="btn btn-primary">Sign In</button>
        </SignInButton>
      </div>
    )
  }

  if (!registrationId) {
    return (
      <div className="fullscreen-loading">
        <h2>No registration reference provided</h2>
        <Link to="/discover" className="btn btn-secondary">Explore Events</Link>
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="fullscreen-loading">
        <h2>Could not retrieve registration record</h2>
        <button type="button" className="btn btn-secondary" onClick={() => setRefresh((v) => v + 1)}>
          Check Again
        </button>
      </div>
    )
  }

  const { registration } = state
  const paymentStatus = registration.payment?.status
  const confirmed = registration.status === 'CONFIRMED'

  return (
    <main className="public-container" style={{ padding: '60px 24px 80px', display: 'flex', justifyContent: 'center' }}>
      <div
        className="table-card"
        style={{
          maxWidth: '560px',
          width: '100%',
          padding: '40px',
          textAlign: 'center',
          boxShadow: 'var(--shadow-lg)',
        }}
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

        <span className={`badge ${confirmed ? 'badge-emerald' : 'badge-amber'}`} style={{ marginBottom: '12px' }}>
          {confirmed ? 'Payment Confirmed' : cancelled ? 'Checkout Returned' : 'Processing Settlement'}
        </span>

        <h1 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 800 }}>
          {confirmed ? 'Registration Confirmed!' : 'Waiting for Gateway Confirmation'}
        </h1>

        <p style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600, color: 'var(--primary)' }}>
          {registration.event.title}
        </p>

        <p className="text-muted" style={{ margin: '0 0 24px', fontSize: '14px', lineHeight: 1.6 }}>
          {confirmed
            ? 'Your payment was successfully received and verified. Your digital ticket and entrance QR code are ready in your wallet.'
            : 'Payment verification from PayHere usually settles within seconds. Click "Refresh Status" below to update.'}
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
          Registration Reference: <code>{registration.id}</code>
          {paymentStatus && <span className="text-muted"> · Payment: {paymentStatus.toLowerCase()}</span>}
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          {confirmed ? (
            <Link to="/tickets" className="btn btn-primary" style={{ padding: '12px 24px' }}>
              <IconTicket /> View Digital Passes
            </Link>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setRefresh((v) => v + 1)}
            >
              Refresh Status
            </button>
          )}

          <Link to={`/events/${encodeURIComponent(registration.event.id)}`} className="btn btn-secondary">
            Back to Event
          </Link>
        </div>
      </div>
    </main>
  )
}
