import { SignIn, SignUp } from '@clerk/react'
import { Link } from 'react-router'
import { PLACEHOLDER_IMAGES } from '../../lib/placeholders'

const clerkAppearance = {
  layout: {
    socialButtonsPlacement: 'top' as const,
    showOptionalFields: true,
  },
  variables: {
    colorPrimary: '#6366f1',
    colorBackground: 'transparent',
    colorInputBackground: '#f8fafc',
    colorInputText: '#0f172a',
    colorText: '#0f172a',
    colorTextSecondary: '#64748b',
    colorNeutral: '#64748b',
    colorDanger: '#ef4444',
    colorSuccess: '#10b981',
    borderRadius: '10px',
    fontFamily: '"Plus Jakarta Sans", Inter, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: {
      normal: '400',
      medium: '500',
      bold: '700',
    } as Record<string, string>,
    spacingUnit: '16px',
  },
  elements: {
    rootBox: {
      width: '100%',
    },
    cardBox: {
      boxShadow: 'none',
      border: 'none',
      background: 'transparent',
      width: '100%',
      maxWidth: '100%',
      padding: '0',
      borderRadius: '0',
    },
    card: {
      boxShadow: 'none',
      border: 'none',
      padding: '0',
      background: 'transparent',
      width: '100%',
      maxWidth: '100%',
    },
    main: {
      width: '100%',
      padding: '0',
      gap: '16px',
    },
    headerTitle: {
      display: 'none',
    },
    headerSubtitle: {
      display: 'none',
    },
    header: {
      display: 'none',
    },
    socialButtonsBlockButton: {
      border: '1.5px solid #e2e8f0',
      borderRadius: '10px',
      background: '#ffffff',
      fontWeight: '600',
      fontSize: '14px',
      padding: '11px 16px',
      transition: 'all 0.15s ease',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
      color: '#0f172a',
    },
    socialButtonsBlockButtonText: {
      fontWeight: '600',
      color: '#0f172a',
    },
    dividerRow: {
      margin: '16px 0',
    },
    dividerLine: {
      background: '#e2e8f0',
    },
    dividerText: {
      color: '#94a3b8',
      fontSize: '12px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    },
    form: {
      gap: '14px',
    },
    formFieldRow: {
      gap: '12px',
    },
    formFieldLabel: {
      color: '#334155',
      fontSize: '13px',
      fontWeight: '600',
      marginBottom: '6px',
    },
    formFieldInput: {
      background: '#f8fafc',
      border: '1.5px solid #e2e8f0',
      borderRadius: '10px',
      fontSize: '14px',
      padding: '11px 14px',
      color: '#0f172a',
      transition: 'all 0.15s ease',
      boxShadow: 'none',
    },
    formButtonPrimary: {
      background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: '700',
      padding: '12px 24px',
      boxShadow: '0 2px 8px rgba(79, 70, 229, 0.35)',
      transition: 'all 0.18s ease',
      border: 'none',
      marginTop: '8px',
    },
    footer: {
      background: 'transparent',
      padding: '16px 0 0 0',
      border: 'none',
      boxShadow: 'none',
    },
    footerAction: {
      justifyContent: 'center',
    },
    footerActionText: {
      color: '#64748b',
      fontSize: '13px',
    },
    footerActionLink: {
      color: '#6366f1',
      fontWeight: '600',
      fontSize: '13px',
    },
    footerPages: {
      display: 'none',
    },
    identityPreviewText: {
      color: '#0f172a',
    },
    alertText: {
      fontSize: '13px',
    },
  },
}

export function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const signingIn = mode === 'sign-in'

  return (
    <main className="auth-split-layout">
      {/* LEFT: Visual Brand Panel */}
      <div className="auth-brand-panel">
        <div className="auth-brand-bg">
          <img
            src={signingIn ? PLACEHOLDER_IMAGES.hero : PLACEHOLDER_IMAGES.community}
            alt=""
            aria-hidden="true"
            className="auth-brand-img"
          />
          <div className="auth-brand-overlay" />
        </div>

        <div className="auth-brand-content">
          {/* Logo */}
          <Link to="/" className="auth-brand-logo">
            eventora<span style={{ color: '#818cf8' }}>.</span>
          </Link>

          <div className="auth-brand-body">
            <div className="auth-brand-tagline">
              {signingIn ? 'Welcome back.' : 'Your next great day starts here.'}
            </div>
            <p className="auth-brand-subtitle">
              {signingIn
                ? 'Sign in to access your tickets, event dashboard, and organizer workspace.'
                : 'Join thousands discovering events worth attending. Book, collect, and check in — all in one place.'}
            </p>

            {/* Feature Pills */}
            <div className="auth-feature-pills">
              <span className="auth-pill">🎟 Instant QR Tickets</span>
              <span className="auth-pill">💳 Secure PayHere Checkout</span>
              <span className="auth-pill">📸 Live Door Check-in</span>
            </div>
          </div>

          <Link to="/discover" className="auth-explore-link">
            Explore upcoming events →
          </Link>
        </div>
      </div>

      {/* RIGHT: Auth Form Panel */}
      <div className="auth-form-panel">
        <div className="auth-form-inner">
          <Link to="/" className="auth-back-link">
            ← Back to Eventora
          </Link>

          <div className="auth-form-header">
            <span className="auth-form-eyebrow">
              {signingIn ? 'Your account' : 'Get started for free'}
            </span>
            <h1 className="auth-form-title">
              {signingIn ? 'Sign in to Eventora' : 'Create your account'}
            </h1>
            <p className="auth-form-desc">
              {signingIn
                ? 'Access tickets and your Eventora dashboard.'
                : 'Your place for events worth attending.'}
            </p>
          </div>

          <div className="auth-clerk-wrapper">
            {signingIn ? (
              <SignIn
                routing="path"
                path="/sign-in"
                signUpUrl="/sign-up"
                forceRedirectUrl="/account"
                appearance={clerkAppearance}
              />
            ) : (
              <SignUp
                routing="path"
                path="/sign-up"
                signInUrl="/sign-in"
                forceRedirectUrl="/account"
                appearance={clerkAppearance}
              />
            )}
          </div>

          <p className="auth-form-footer-note">
            By continuing, you agree to Eventora's{' '}
            <a href="#" style={{ color: 'var(--primary)' }}>Terms of Service</a>
            {' '}and{' '}
            <a href="#" style={{ color: 'var(--primary)' }}>Privacy Policy</a>.
          </p>
        </div>
      </div>
    </main>
  )
}
