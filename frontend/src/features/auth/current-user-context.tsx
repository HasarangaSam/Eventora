import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useAuth } from '@clerk/react'
import { Navigate, useLocation } from 'react-router'
import { useAuthenticatedApi } from './use-authenticated-api'

export type UserRole = 'ATTENDEE' | 'ORGANIZER' | 'ADMIN'

export interface CurrentUser {
  email: string
  firstName: string | null
  lastName: string | null
  role: UserRole
  status: 'ACTIVE' | 'DEACTIVATED'
}

interface CurrentUserContextValue {
  user: CurrentUser | null
  role: UserRole | null
  isLoading: boolean
  refetch: () => Promise<void>
}

const CurrentUserContext = createContext<CurrentUserContextValue>({
  user: null,
  role: null,
  isLoading: false,
  refetch: async () => {},
})

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const authenticatedRequest = useAuthenticatedApi()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchUser = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setUser(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const { data } = await authenticatedRequest<CurrentUser>({ method: 'GET', url: '/auth/me' })
      setUser(data)
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [authenticatedRequest, isLoaded, isSignedIn, userId])

  useEffect(() => {
    void fetchUser()
  }, [fetchUser])

  return (
    <CurrentUserContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        isLoading: isLoaded && isSignedIn ? isLoading : false,
        refetch: fetchUser,
      }}
    >
      {children}
    </CurrentUserContext.Provider>
  )
}

export function useCurrentUser() {
  return useContext(CurrentUserContext)
}

/**
 * Ensures that Admins and Organizers cannot access public consumer pages.
 * - Admin is redirected to /admin
 * - Organizer is redirected to /account
 * - Attendees and Guests pass through to the public page.
 */
export function PublicRouteGuard({ children }: { children: ReactNode }) {
  const { role, isLoading } = useCurrentUser()
  const { isSignedIn, isLoaded } = useAuth()

  if (isLoaded && isSignedIn && isLoading) {
    return (
      <div className="fullscreen-loading">
        <div className="spinner" />
        <p>Loading your workspace…</p>
      </div>
    )
  }

  if (role === 'ADMIN') {
    return <Navigate to="/admin" replace />
  }

  if (role === 'ORGANIZER') {
    return <Navigate to="/organizer" replace />
  }

  return <>{children}</>
}

/**
 * Dedicated guard for Admin routes.
 */
export function AdminRouteGuard({ children }: { children: ReactNode }) {
  const { role, isLoading } = useCurrentUser()
  const { isSignedIn, isLoaded } = useAuth()
  const location = useLocation()

  if (!isLoaded || (isSignedIn && isLoading)) {
    return (
      <div className="fullscreen-loading">
        <div className="spinner" />
        <p>Verifying administrative credentials…</p>
      </div>
    )
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />
  }

  if (role !== 'ADMIN') {
    return <Navigate to="/account" replace />
  }

  return <>{children}</>
}

/**
 * Dedicated guard for Organizer routes.
 */
export function OrganizerRouteGuard({ children }: { children: ReactNode }) {
  const { role, isLoading } = useCurrentUser()
  const { isSignedIn, isLoaded } = useAuth()
  const location = useLocation()

  if (!isLoaded || (isSignedIn && isLoading)) {
    return (
      <div className="fullscreen-loading">
        <div className="spinner" />
        <p>Verifying organizer credentials…</p>
      </div>
    )
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />
  }

  if (role !== 'ORGANIZER' && role !== 'ADMIN') {
    return <Navigate to="/account" replace />
  }

  return <>{children}</>
}
