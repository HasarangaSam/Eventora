import { SignIn, SignUp } from '@clerk/react'
import { Link } from 'react-router'
import { PLACEHOLDER_IMAGES } from '../../lib/placeholders'
import { EventoraLogo } from '../../components/layout/eventora-logo'

const clerkAppearance = {
  layout: {
    socialButtonsPlacement: 'top' as const,
    showOptionalFields: true,
  },
  options: {
    elevation: 'flush' as const,
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
    footerPagesLink: {
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
    <main className="grid [grid-template-columns:1fr_1fr] min-h-screen overflow-hidden max-[768px]:[grid-template-columns:1fr] max-[768px]:[grid-template-rows:auto_1fr]">
      {/* LEFT: Visual Brand Panel */}
      <div className="group relative overflow-hidden bg-[#0b0f19] flex flex-col max-[768px]:min-h-[240px] max-[768px]:max-h-[280px]">
        <div className="absolute [inset:0] z-[0]">
          <img
            src={signingIn ? PLACEHOLDER_IMAGES.hero : PLACEHOLDER_IMAGES.community}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover opacity-[0.45] scale-[1.04] transition-transform duration-[8000ms] ease-[ease] group-hover:scale-100"
          />
          <div className="absolute [inset:0] bg-[linear-gradient(_160deg,_rgba(11,_15,_25,_0.55)_0%,_rgba(79,_70,_229,_0.35)_50%,_rgba(11,_15,_25,_0.75)_100%_)]" />
        </div>

        <div className="relative z-[1] flex flex-col justify-between h-full py-11 px-12 max-[768px]:py-7 max-[768px]:px-6 min-[769px]:max-[1024px]:py-9 min-[769px]:max-[1024px]:px-9">
          {/* Logo */}
          <Link to="/" className="w-fit rounded-md transition-opacity hover:opacity-85">
            <EventoraLogo tone="light" size="regular" />
          </Link>

          <div className="[flex:1] flex flex-col justify-center gap-5 py-10 px-0">
            <div className="text-[clamp(32px,_4vw,_48px)] font-black text-white leading-[1.1] tracking-[-1px] max-[768px]:text-[26px]">
              {signingIn ? 'Welcome back.' : 'Your next great day starts here.'}
            </div>
            <p className="m-0 text-base leading-[1.65] text-[rgba(255,_255,_255,_0.75)] max-w-[380px] max-[768px]:hidden">
              {signingIn
                ? 'Sign in to access your tickets, event dashboard, and organizer workspace.'
                : 'Join thousands discovering events worth attending. Book, collect, and check in — all in one place.'}
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap gap-2.5 mt-2 max-[768px]:hidden">
              <span className="inline-flex items-center gap-1.5 py-[7px] px-3.5 bg-[rgba(255,_255,_255,_0.12)] border rounded-[var(--radius-full)] text-[13px] font-semibold text-[rgba(255,_255,_255,_0.9)] backdrop-blur-[8px] [transition:all_0.15s_ease] hover:bg-[rgba(255,_255,_255,_0.2)] hover:border-[rgba(255,_255,_255,_0.35)]">🎟 Instant QR Tickets</span>
              <span className="inline-flex items-center gap-1.5 py-[7px] px-3.5 bg-[rgba(255,_255,_255,_0.12)] border rounded-[var(--radius-full)] text-[13px] font-semibold text-[rgba(255,_255,_255,_0.9)] backdrop-blur-[8px] [transition:all_0.15s_ease] hover:bg-[rgba(255,_255,_255,_0.2)] hover:border-[rgba(255,_255,_255,_0.35)]">💳 Secure PayHere Checkout</span>
              <span className="inline-flex items-center gap-1.5 py-[7px] px-3.5 bg-[rgba(255,_255,_255,_0.12)] border rounded-[var(--radius-full)] text-[13px] font-semibold text-[rgba(255,_255,_255,_0.9)] backdrop-blur-[8px] [transition:all_0.15s_ease] hover:bg-[rgba(255,_255,_255,_0.2)] hover:border-[rgba(255,_255,_255,_0.35)]">📸 Live Door Check-in</span>
            </div>
          </div>

          <Link to="/discover" className="inline-flex items-center gap-1.5 text-[rgba(255,_255,_255,_0.7)] text-sm font-semibold no-underline [transition:all_0.15s_ease] py-1 px-0 border-b w-fit hover:text-white hover:border-[rgba(255,_255,_255,_0.6)] max-[768px]:hidden">
            Explore upcoming events →
          </Link>
        </div>
      </div>

      {/* RIGHT: Auth Form Panel */}
      <div className="bg-white flex items-center justify-center overflow-y-auto py-10 px-6 max-[768px]:py-8 max-[768px]:px-5 max-[768px]:items-start">
        <div className="w-full max-w-[440px] flex flex-col gap-7 max-[768px]:max-w-full max-[768px]:gap-5 min-[769px]:max-[1024px]:max-w-[400px]">
          <Link to="/" className="inline-flex items-center gap-1.5 text-[var(--text-muted)] text-[13px] font-semibold no-underline [transition:color_0.15s_ease] py-1.5 px-2.5 my--1.5 mx--2.5 rounded-[var(--radius-sm)] hover:text-[var(--text-main)] hover:bg-[var(--surface-hover)]">
            ← Back to Eventora
          </Link>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[1.5px] text-[var(--primary)]">
              {signingIn ? 'Your account' : 'Get started for free'}
            </span>
            <h1 className="m-0 text-[clamp(24px,_3vw,_30px)] font-black text-[var(--text-main)] tracking-[-0.5px] leading-[1.2]">
              {signingIn ? 'Sign in to Eventora' : 'Create your account'}
            </h1>
            <p className="m-0 text-[15px] text-[var(--text-muted)] leading-[1.55]">
              {signingIn
                ? 'Access tickets and your Eventora dashboard.'
                : 'Your place for events worth attending.'}
            </p>
          </div>

          <div className="w-full">
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

          <p className="m-0 text-xs text-[var(--text-subtle)] text-center leading-[1.6]">
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
