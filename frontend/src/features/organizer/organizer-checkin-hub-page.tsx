import { useState } from 'react'
import { Link } from 'react-router'
import { DashboardShell } from '../analytics/dashboard-shell'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { useToast } from '../../components/ui/toast'
import { useEffect, useCallback } from 'react'
import { IconCamera, IconCalendar } from '../../components/ui/icons'

interface OrganizerEvent {
  id: string
  title: string
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED'
  startAt: string
  city: string
  venue: string
}

export function OrganizerCheckinHubPage() {
  const request = useAuthenticatedApi()
  const toast = useToast()
  const [events, setEvents] = useState<OrganizerEvent[]>([])
  const [loading, setLoading] = useState(true)

  const loadEvents = useCallback(async () => {
    try {
      const { data } = await request<OrganizerEvent[]>({ method: 'GET', url: '/organizer/events' })
      // Only show published or live events for check-in
      setEvents(data.filter((e) => e.status === 'PUBLISHED'))
    } catch {
      toast.error('Load Error', 'Could not load your events for check-in.')
    } finally {
      setLoading(false)
    }
  }, [request, toast])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  return (
    <DashboardShell role="ORGANIZER" pageTitle="Door Check-in Hub">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {/* Header Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: '#ffffff',
            borderRadius: 'var(--radius-xl)',
            padding: '32px 36px',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              opacity: 0.85,
            }}
          >
            Real-Time Door Console
          </span>
          <h2
            style={{
              margin: '6px 0 8px',
              fontSize: '26px',
              fontWeight: 800,
              lineHeight: 1.2,
            }}
          >
            QR Ticket Check-in
          </h2>
          <p style={{ margin: 0, opacity: 0.9, fontSize: '14px' }}>
            Select an active published event below to open the door console and start scanning attendee QR passes.
          </p>
        </div>

        {/* Event Selection */}
        <section className="table-card" style={{ margin: 0 }}>
          <div className="table-header">
            <div>
              <h3>Select Event for Check-in</h3>
              <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
                Only currently published events appear here. Draft and completed events are excluded.
              </p>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <p className="text-muted">Loading your events…</p>
            </div>
          ) : events.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: '#fffbeb',
                  color: '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <IconCalendar style={{ width: '28px', height: '28px' }} />
              </div>
              <h4 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>
                No Published Events
              </h4>
              <p style={{ margin: '0 0 20px', fontSize: '14px' }}>
                You have no currently published events. Publish an event first to enable check-in.
              </p>
              <Link to="/organizer/events" className="btn btn-primary btn-sm">
                Go to Events Studio →
              </Link>
            </div>
          ) : (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {events.map((event) => (
                <div
                  key={event.id}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '16px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: 'var(--radius-md)',
                        background: '#ecfdf5',
                        color: 'var(--success)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <IconCamera style={{ width: '20px', height: '20px' }} />
                    </div>
                    <div>
                      <strong style={{ display: 'block', fontSize: '16px', marginBottom: '4px' }}>
                        {event.title}
                      </strong>
                      <span className="text-muted" style={{ fontSize: '13px' }}>
                        {event.venue} · {event.city} ·{' '}
                        {new Date(event.startAt).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="badge badge-emerald">
                      <span className="badge-dot" />
                      Live
                    </span>
                    <Link
                      to={`/organizer/events/${event.id}/check-in`}
                      className="btn btn-primary btn-sm"
                    >
                      <IconCamera style={{ width: '14px', height: '14px' }} />
                      Open Console
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  )
}
