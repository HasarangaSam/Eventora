import { DashboardShell } from '../analytics/dashboard-shell'
import { useCurrentUser } from '../auth/current-user-context'
import { UserButton } from '@clerk/react'

export function OrganizerProfilePage() {
  const { user } = useCurrentUser()

  return (
    <DashboardShell role="ORGANIZER" pageTitle="Organizer Profile">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {/* Profile Card */}
        <section className="table-card" style={{ margin: 0 }}>
          <div className="table-header">
            <div>
              <h3>Organizer Profile</h3>
              <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
                Your public identity on the Eventora platform.
              </p>
            </div>
          </div>

          <div style={{ padding: '32px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
                flexWrap: 'wrap',
                marginBottom: '32px',
              }}
            >
              <div
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {(user?.firstName?.[0] || user?.email?.[0] || 'O').toUpperCase()}
              </div>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 800 }}>
                  {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Organizer Account'}
                </h2>
                <p className="text-muted" style={{ margin: '0 0 10px', fontSize: '14px' }}>
                  {user?.email}
                </p>
                <span className="badge badge-emerald">
                  <span className="badge-dot" />
                  Verified Organizer
                </span>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <UserButton />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '20px',
              }}
            >
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '18px 20px',
                }}
              >
                <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  First Name
                </span>
                <p style={{ margin: '6px 0 0', fontSize: '15px', fontWeight: 600 }}>
                  {user?.firstName ?? '—'}
                </p>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '18px 20px',
                }}
              >
                <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Last Name
                </span>
                <p style={{ margin: '6px 0 0', fontSize: '15px', fontWeight: 600 }}>
                  {user?.lastName ?? '—'}
                </p>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '18px 20px',
                }}
              >
                <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Email Address
                </span>
                <p style={{ margin: '6px 0 0', fontSize: '15px', fontWeight: 600 }}>
                  {user?.email ?? '—'}
                </p>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '18px 20px',
                }}
              >
                <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Account Role
                </span>
                <p style={{ margin: '6px 0 0', fontSize: '15px', fontWeight: 600 }}>
                  Organizer
                </p>
              </div>
            </div>

            <div
              style={{
                marginTop: '24px',
                padding: '16px 20px',
                background: '#eef2ff',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #c7d2fe',
              }}
            >
              <p style={{ margin: 0, fontSize: '14px', color: '#4338ca' }}>
                <strong>Profile management:</strong> To update your name, email, or profile photo, click the account button in the top right of the sidebar. Changes sync automatically across the platform.
              </p>
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}
