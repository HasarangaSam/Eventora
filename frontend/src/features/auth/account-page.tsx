import { SignInButton, useAuth } from '@clerk/react'
import { AxiosError } from 'axios'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuthenticatedApi } from './use-authenticated-api'
import { OrganizerApplicationPanel } from '../organizer/organizer-application-panel'
import { OrganizerEventsDashboard } from '../organizer/organizer-events-dashboard'
import { DashboardPanel } from '../analytics/dashboard-panel'
import { DashboardShell } from '../analytics/dashboard-shell'

interface CurrentUser {
  email: string
  firstName: string | null
  lastName: string | null
  role: 'ATTENDEE' | 'ORGANIZER' | 'ADMIN'
  status: 'ACTIVE' | 'DEACTIVATED'
}

type AccountState =
  | { status: 'loading' }
  | { status: 'ready'; clerkUserId: string; user: CurrentUser }
  | { status: 'error'; clerkUserId: string; message: string }

export function AccountPage() {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const authenticatedRequest = useAuthenticatedApi()
  const [account, setAccount] = useState<AccountState>({ status: 'loading' })
  const [requestVersion, setRequestVersion] = useState(0)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return
    let active = true

    void authenticatedRequest<CurrentUser>({ method: 'GET', url: '/auth/me' })
      .then(({ data }) => {
        if (active) setAccount({ status: 'ready', clerkUserId: userId, user: data })
      })
      .catch((error: unknown) => {
        if (!active) return
        const message = error instanceof AxiosError && error.response?.status === 403
          ? 'This Eventora account is deactivated. Contact support if you think this is a mistake.'
          : 'We could not load your Eventora profile. Please try again.'
        setAccount({ status: 'error', clerkUserId: userId, message })
      })

    return () => { active = false }
  }, [authenticatedRequest, isLoaded, isSignedIn, requestVersion, userId])

  if (!isLoaded) {
    return <main className="account-page" aria-live="polite"><p>Checking your session…</p></main>
  }

  if (!isSignedIn) {
    return (
      <main className="account-page">
        <span className="eyebrow">Your Eventora account</span>
        <h1>Sign in to continue.</h1>
        <p>Your registrations and profile are available after signing in.</p>
        <SignInButton mode="modal"><button className="button button--dark">Sign in</button></SignInButton>
      </main>
    )
  }

  const accountLoading = account.status === 'loading' || account.clerkUserId !== userId

  const currentRole = account.status === 'ready' ? account.user.role : 'ATTENDEE'
  return <DashboardShell role={currentRole}><main className="account-page" aria-labelledby="account-title" aria-live="polite">
      <span className="eyebrow">Your Eventora account</span>
      <h1 id="account-title">Welcome{!accountLoading && account.status === 'ready' && account.user.firstName ? `, ${account.user.firstName}` : ''}.</h1>
      {accountLoading && <p>Loading your profile…</p>}
      {!accountLoading && account.status === 'error' && (
        <div className="account-error" role="alert">
          <p>{account.message}</p>
          <button className="text-button" onClick={() => {
            setAccount({ status: 'loading' })
            setRequestVersion((version) => version + 1)
          }} type="button">Try again</button>
        </div>
      )}
      {!accountLoading && account.status === 'ready' && (
        <section className="account-card" aria-label="Account details">
          <p><span>Email</span><strong>{account.user.email}</strong></p>
          <p><span>Account type</span><strong>{account.user.role.toLowerCase()}</strong></p>
          <p><span>Account status</span><strong>{account.user.status.toLowerCase()}</strong></p>
        </section>
      )}
      {!accountLoading && account.status === 'ready' && account.user.status === 'ACTIVE' && <>
        <div id="analytics"><DashboardPanel role={account.user.role} /></div>
        {account.user.role === 'ADMIN' && <Link className="account-home-link" to="/admin">Open administrator workspace</Link>}
        {account.user.role === 'ORGANIZER' && <div id="organizer-events"><OrganizerEventsDashboard /></div>}
        <OrganizerApplicationPanel role={account.user.role} firstName={account.user.firstName} lastName={account.user.lastName} email={account.user.email} />
      </>}
      <Link className="account-home-link" to="/">Back to event discovery</Link>
    </main></DashboardShell>
}
