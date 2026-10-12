import { SignIn, SignUp } from '@clerk/react'
import { Link } from 'react-router'

export function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const signingIn = mode === 'sign-in'
  return <main className="auth-page"><section className="auth-visual" aria-label="Eventora welcome"><span className="eyebrow">Make a plan worth remembering</span><div><h1>{signingIn ? 'Welcome back.' : 'Your next great day starts here.'}</h1><p>{signingIn ? 'Pick up where your next experience begins.' : 'Join Eventora to find events, book tickets, and keep them close.'}</p></div><Link to="/discover">Explore events <span aria-hidden="true">↗</span></Link></section>
    <section className="auth-form-panel" aria-label={signingIn ? 'Sign in' : 'Create your account'}><Link className="back-link" to="/">← Eventora home</Link><span className="eyebrow">{signingIn ? 'Your account' : 'Get started'}</span><h2>{signingIn ? 'Sign in' : 'Create an account'}</h2><p>{signingIn ? 'Access tickets and your Eventora dashboard.' : 'Your place for events worth attending.'}</p>
      {signingIn ? <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/account" /> : <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/account" />}
    </section></main>
}
