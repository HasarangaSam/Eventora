import { useCallback, useEffect, useState } from 'react'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { DashboardShell } from '../analytics/dashboard-shell'
import { useToast } from '../../components/ui/toast'
import { PromptModal } from '../../components/ui/modal'
import { IconSearch } from '../../components/ui/icons'

interface ManagedEvent {
  id: string
  title: string
  city: string
  venue: string
  startAt: string
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED'
  ticketsReserved: number
  ticketsSold: number
  organizer: { email: string; firstName: string | null; lastName: string | null }
  _count: { registrations: number; tickets: number }
}

export function AdminEventsPage() {
  const request = useAuthenticatedApi()
  const toast = useToast()
  const [events, setEvents] = useState<ManagedEvent[]>([])
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Cancel Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [targetEvent, setTargetEvent] = useState<ManagedEvent | null>(null)
  const [cancelBusy, setCancelBusy] = useState(false)

  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await request<ManagedEvent[]>({
        method: 'GET',
        url: `/admin/events${status ? `?status=${encodeURIComponent(status)}` : ''}`,
      })
      setEvents(data)
    } catch {
      toast.error('Events Load Error', 'Could not load platform events for oversight.')
    } finally {
      setLoading(false)
    }
  }, [request, status, toast])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  async function handleCancelSubmit(reason: string) {
    if (!targetEvent) return
    setCancelBusy(true)
    try {
      const { data } = await request<{ cancellationNoticesQueued: number }>({
        method: 'PATCH',
        url: `/admin/events/${targetEvent.id}/cancel`,
        data: { reason },
      })
      toast.success(
        'Event Cancelled',
        `“${targetEvent.title}” has been cancelled. ${data.cancellationNoticesQueued} attendee notice(s) queued.`,
      )
      setCancelModalOpen(false)
      setTargetEvent(null)
      await loadEvents()
    } catch {
      toast.error('Cancellation Failed', 'The event could not be cancelled. Refresh and try again.')
    } finally {
      setCancelBusy(false)
    }
  }

  const filteredEvents = events.filter((e) =>
    `${e.title} ${e.city} ${e.organizer.email}`.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <DashboardShell role="ADMIN" pageTitle="Platform Events Oversight">
      <section className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ margin: 0 }}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5 [&_h3]:m-0 [&_h3]:text-lg [&_h3]:font-bold" style={{ flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3>All Platform Events ({events.length})</h3>
            <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
              Inspect live, draft, or completed events and execute administrative killswitches if needed.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <IconSearch
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '10px',
                  width: '16px',
                  height: '16px',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="search"
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                style={{ paddingLeft: '34px', width: '240px' }}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title, city, host…"
              />
            </div>
            <select
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
              style={{ width: '150px' }}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-left [&_th]:border-b [&_th]:border-[var(--border)] [&_th]:bg-slate-50 [&_th]:px-5 [&_th]:py-3.5 [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-[0.5px] [&_th]:text-[var(--text-muted)] [&_th]:uppercase [&_td]:border-b [&_td]:border-[var(--border)] [&_td]:px-5 [&_td]:py-4 [&_td]:text-sm [&_td]:text-[var(--text-main)] [&_td]:align-middle [&_tr:last-child_td]:border-b-0 [&_tr:hover_td]:bg-slate-50">
            <thead>
              <tr>
                <th>Event Title</th>
                <th>Host / Organizer</th>
                <th>Status</th>
                <th>Location & Date</th>
                <th>Tickets Sold</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="h-8 w-8 rounded-full border-[3px] border-[rgba(99,102,241,0.2)] border-t-[var(--primary)] animate-[spin_0.8s_linear_infinite]" style={{ margin: '0 auto 8px' }} />
                    <span className="text-muted">Loading events…</span>
                  </td>
                </tr>
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No events found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((e) => (
                  <tr key={e.id}>
                    <td><strong>{e.title}</strong></td>
                    <td>
                      <span>{[e.organizer.firstName, e.organizer.lastName].filter(Boolean).join(' ') || e.organizer.email}</span>
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none capitalize ${e.status === 'PUBLISHED'
                            ? "border border-[#a7f3d0] bg-[#ecfdf5] text-[#059669] [--badge-dot-color:#10b981]"
                            : e.status === 'CANCELLED'
                              ? "border border-[#fecaca] bg-[#fef2f2] text-[#dc2626] [--badge-dot-color:#ef4444]"
                              : "border border-slate-200 bg-slate-100 text-slate-600 [--badge-dot-color:#64748b]"}`}
                      >
                        <span className="h-[6px] w-[6px] rounded-full bg-[var(--badge-dot-color)]" />
                        {e.status.toLowerCase()}
                      </span>
                    </td>
                    <td>{e.city} · {new Date(e.startAt).toLocaleDateString()}</td>
                    <td>
                      <strong>{e.ticketsSold.toLocaleString()}</strong> sold ({e.ticketsReserved.toLocaleString()} reserved)
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {e.status !== 'CANCELLED' && e.status !== 'COMPLETED' && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border-0 bg-transparent px-2 py-1 text-[13px] font-semibold text-[var(--text-button-color,var(--primary))] cursor-pointer transition-[all] duration-150 hover:bg-[var(--text-button-bg,var(--primary-light))] hover:text-[var(--text-button-hover,var(--primary-hover))] [--text-button-color:var(--danger)] [--text-button-hover:#b91c1c] [--text-button-bg:var(--danger-bg)]"
                          onClick={() => {
                            setTargetEvent(e)
                            setCancelModalOpen(true)
                          }}
                        >
                          Cancel Event
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Accessible Cancellation Dialog */}
        <PromptModal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          onConfirm={handleCancelSubmit}
          title={`Cancel “${targetEvent?.title}”?`}
          message="Canceling this event immediately disables ticket sales and dispatches automated cancellation notices to all registered attendees."
          label="Reason for cancellation"
          placeholder="e.g. Venue emergency closure or safety requirement"
          confirmText="Confirm & Dispatch Notices"
          minLength={5}
          loading={cancelBusy}
        />
      </section>
    </DashboardShell>
  )
}
