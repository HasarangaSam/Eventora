import { DashboardShell } from '../analytics/dashboard-shell'
import { DashboardPanel } from '../analytics/dashboard-panel'
import { OrganizerEventsDashboard } from './organizer-events-dashboard'

export function OrganizerEventsPage() {
  return (
    <DashboardShell role="ORGANIZER" pageTitle="Events Studio">
      <OrganizerEventsDashboard />
    </DashboardShell>
  )
}

export function OrganizerSalesPage() {
  return (
    <DashboardShell role="ORGANIZER" pageTitle="Sales & Revenue Analytics">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
            color: '#ffffff',
            borderRadius: 'var(--radius-xl)',
            padding: '32px 36px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '20px',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                opacity: 0.85,
              }}
            >
              Revenue Center
            </span>
            <h2
              style={{
                margin: '6px 0 8px',
                fontSize: '26px',
                fontWeight: 800,
                lineHeight: 1.2,
              }}
            >
              Sales & Revenue Analytics
            </h2>
            <p style={{ margin: 0, opacity: 0.9, fontSize: '14px' }}>
              Monitor ticket revenue, payment verification trends, and gross sales across all your events.
            </p>
          </div>
        </div>

        <DashboardPanel role="ORGANIZER" />
      </div>
    </DashboardShell>
  )
}
