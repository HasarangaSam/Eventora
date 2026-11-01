import { useCallback, useEffect, useState } from 'react'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { DashboardShell } from '../analytics/dashboard-shell'
import { useToast } from '../../components/ui/toast'
import { PromptModal } from '../../components/ui/modal'
import { IconSearch } from '../../components/ui/icons'
import { AdminPagination } from './admin-pagination'

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
interface EventDetails extends ManagedEvent {
  description: string
  endAt: string
  capacity: number | null
  cancellationReason: string | null
  category: { name: string }
  ticketTypes: Array<{ id: string; name: string; price: string; currency: string; quantity: number; quantitySold: number; quantityReserved: number; isActive: boolean }>
  sessions: Array<{ id: string; title: string; startAt: string; endAt: string; speaker: string | null }>
  _count: { registrations: number; tickets: number; reservations: number; checkIns: number }
}

export function AdminEventsPage() {
  const request = useAuthenticatedApi()
  const toast = useToast()
  const [events, setEvents] = useState<ManagedEvent[]>([])
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageData, setPageData] = useState({ total: 0, pageCount: 0 })
  const [detail, setDetail] = useState<EventDetails | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Cancel Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [targetEvent, setTargetEvent] = useState<ManagedEvent | null>(null)
  const [cancelBusy, setCancelBusy] = useState(false)

  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' })
      if (status) params.set('status', status)
      if (query.trim()) params.set('search', query.trim())
      const { data } = await request<{ items: ManagedEvent[]; total: number; pageCount: number }>({
        method: 'GET',
        url: `/admin/events?${params.toString()}`,
      })
      setEvents(data.items)
      setPageData({ total: data.total, pageCount: data.pageCount })
    } catch {
      toast.error('Events Load Error', 'Could not load platform events for oversight.')
    } finally {
      setLoading(false)
    }
  }, [page, query, request, status, toast])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  async function openDetails(event: ManagedEvent) {
    setDetailLoading(true)
    try {
      const { data } = await request<EventDetails>({ method: 'GET', url: `/admin/events/${event.id}` })
      setDetail(data)
    } catch {
      toast.error('Event Details Unavailable', 'Refresh the list and try again.')
    } finally { setDetailLoading(false) }
  }

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

  useEffect(() => { setPage(1) }, [query, status])

  return (
    <DashboardShell role="ADMIN" pageTitle="Events">
      <section className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ margin: 0 }}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5 [&_h3]:m-0 [&_h3]:text-lg [&_h3]:font-bold" style={{ flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3>All Platform Events ({pageData.total})</h3>
            <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
              Review event details and status across all organizers. Cancel an event if platform rules require it.
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
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No events found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                events.map((e) => (
                  <tr key={e.id}>
                    <td><button type="button" onClick={() => void openDetails(e)} className="text-left font-semibold text-indigo-700 hover:underline">{e.title}</button></td>
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
        {!loading && <AdminPagination page={page} pageCount={pageData.pageCount} total={pageData.total} onPage={setPage} />}

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
      {(detail || detailLoading) && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null) }}><aside role="dialog" aria-modal="true" aria-label="Event details" className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">Event oversight</p><h2 className="m-0 text-xl font-bold text-slate-900">{detail?.title ?? 'Loading event…'}</h2></div><button onClick={() => setDetail(null)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">Close</button></div>{detailLoading && !detail ? <p className="mt-6 text-sm text-slate-500">Loading full event record…</p> : detail && <div className="mt-6 space-y-5 text-sm"><section className="rounded-lg bg-slate-50 p-4"><p className="m-0 font-semibold text-slate-900">{detail.category.name} · {detail.status.toLowerCase()}</p><p className="mb-0 mt-2 text-slate-600">{detail.description}</p><p className="mb-0 mt-2 text-slate-500">{detail.venue}, {detail.city} · {new Date(detail.startAt).toLocaleString()} – {new Date(detail.endAt).toLocaleString()}</p></section><section className="grid grid-cols-2 gap-3">{[['Tickets sold', detail.ticketsSold], ['Reserved', detail.ticketsReserved], ['Registrations', detail._count.registrations], ['Checked in', detail._count.checkIns]].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 p-3"><span className="text-xs text-slate-500">{label}</span><strong className="mt-1 block text-lg text-slate-900">{value}</strong></div>)}</section><section><h3 className="mb-2 mt-0 font-semibold text-slate-900">Ticket inventory</h3><div className="divide-y divide-slate-100 rounded-lg border border-slate-200">{detail.ticketTypes.map((ticket) => <div key={ticket.id} className="flex justify-between gap-3 p-3"><span>{ticket.name}{!ticket.isActive && ' · inactive'}</span><span className="text-right text-slate-600">{ticket.currency} {ticket.price} · {ticket.quantitySold} sold · {ticket.quantityReserved} reserved</span></div>)}</div></section><section><h3 className="mb-2 mt-0 font-semibold text-slate-900">Schedule</h3>{detail.sessions.length ? detail.sessions.map((session) => <p key={session.id} className="m-0 border-b border-slate-100 py-2"><strong>{session.title}</strong> · {new Date(session.startAt).toLocaleString()}{session.speaker ? ` · ${session.speaker}` : ''}</p>) : <p className="m-0 text-slate-500">No additional sessions.</p>}</section>{detail.cancellationReason && <p className="m-0 rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800">Cancellation reason: {detail.cancellationReason}</p>}</div>}</aside></div>}
    </DashboardShell>
  )
}
