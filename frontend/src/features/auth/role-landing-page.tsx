import { useAuth } from '@clerk/react'
import { Navigate, useSearchParams } from 'react-router'
import { useCurrentUser } from './current-user-context'

function safeReturnPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin) return null
    if (['/sign-in', '/sign-up', '/auth/continue'].includes(url.pathname)) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

export function RoleLandingPage() {
  const { isLoaded, isSignedIn } = useAuth()
  const { role, isLoading, loadError, refetch } = useCurrentUser()
  const [searchParams] = useSearchParams()

  if (!isLoaded) return <LandingStatus message="Finishing sign-in…" />
  if (!isSignedIn) return <Navigate to="/sign-in" replace />

  if (isLoading) return <LandingStatus message="Checking your Eventora account…" />

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm" role="alert">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-rose-700">Account check failed</p>
          <h1 className="m-0 text-xl font-bold text-slate-900">We couldn’t open your workspace</h1>
          <p className="mb-0 mt-2 text-sm leading-6 text-slate-600">
            Eventora couldn’t load your account role. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
            disabled={isLoading}
          >
            Try again
          </button>
        </section>
      </main>
    )
  }

  const returnPath = safeReturnPath(searchParams.get('returnTo'))
  const roleHome = role === 'ADMIN' ? '/admin' : role === 'ORGANIZER' ? '/organizer' : '/account'
  return <Navigate to={returnPath ?? roleHome} replace />
}

function LandingStatus({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 font-medium text-slate-600" role="status" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-indigo-100 border-t-indigo-600" />
      <p className="m-0">{message}</p>
    </main>
  )
}
