import { useCallback, useEffect, useState } from 'react'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { DashboardShell } from '../analytics/dashboard-shell'
import { useToast } from '../../components/ui/toast'
import { IconCheck, IconX, IconExternalLink, IconSearch } from '../../components/ui/icons'
import { AdminPagination } from './admin-pagination'
import { AdminNoteModal } from './admin-note-modal'

interface Application {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  organizationName: string
  description: string
  contactName: string | null
  applicantEmail: string | null
  contactPhone: string | null
  organizerType: string | null
  country: string | null
  city: string | null
  websiteUrl: string | null
  experience: string | null
  eventFrequency: string | null
  expectedAttendance: number | null
  accuracyConfirmed: boolean
  rulesAccepted: boolean
  rulesVersion: string | null
  agreedAt: string | null
  eventCategories: Array<{ category: { id: string; name: string } }>
  submittedAt: string
  reviewedAt: string | null
  decisionNote: string | null
  reviewer: { id: string; email: string; firstName: string | null; lastName: string | null } | null
  applicant: { id: string; email: string; firstName: string | null; lastName: string | null }
}

export function AdminApplicationsPage() {
  const request = useAuthenticatedApi()
  const toast = useToast()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('PENDING')
  const [page, setPage] = useState(1)
  const [pageData, setPageData] = useState({ total: 0, pageCount: 0 })
  const [rejecting, setRejecting] = useState<Application | null>(null)

  const loadApplications = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25', status })
      if (query.trim()) params.set('search', query.trim())
      const response = await request<{ items: Application[]; total: number; pageCount: number }>({
        method: 'GET',
        url: `/organizer-applications?${params}`,
      })
      setApplications(response.data.items)
      setPageData({ total: response.data.total, pageCount: response.data.pageCount })
    } catch {
      toast.error('Load Error', 'Could not load organizer applications.')
    } finally {
      setLoading(false)
    }
  }, [page, query, request, status, toast])

  useEffect(() => {
    void loadApplications()
  }, [loadApplications])

  async function decide(id: string, decision: 'APPROVED' | 'REJECTED', orgName: string, decisionNote: string | null = null) {
    if (decision === 'APPROVED' && !window.confirm(`Approve ${orgName} as an event organizer?`)) return
    try {
      await request({ method: 'PATCH', url: `/organizer-applications/${id}/decision`, data: { status: decision, decisionNote } })
      toast.success(
        decision === 'APPROVED' ? 'Application Approved' : 'Application Rejected',
        `${orgName} has been ${decision.toLowerCase()}.`,
      )
      await loadApplications()
    } catch {
      toast.error('Decision Failed', 'The decision could not be recorded. Please try again.')
    }
  }

  useEffect(() => { setPage(1) }, [query, status])

  return (
    <DashboardShell role="ADMIN" pageTitle="Organizer applications">
      <section className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ margin: 0 }}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4 sm:gap-4 sm:px-6 sm:py-5 [&_h3]:m-0 [&_h3]:text-lg [&_h3]:font-bold">
          <div>
            <h3>{status === 'PENDING' ? 'Pending' : status === 'APPROVED' ? 'Approved' : 'Rejected'} Applications ({pageData.total})</h3>
            <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
              Review requests from people and organizations who want to host events.
            </p>
          </div>

          <div className="relative w-full sm:w-auto">
            <IconSearch
              style={{
                position: 'absolute',
                left: '12px',
                top: '11px',
                width: '16px',
                height: '16px',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="search"
              style={{ paddingLeft: '36px' }}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 pl-9 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] sm:w-[260px]"
              placeholder="Search organization or email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5 text-sm sm:w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter application status"><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select>
        </div>

        {loading ? (
          <div className="p-6 text-center sm:p-12">
            <div className="h-8 w-8 rounded-full border-[3px] border-[rgba(99,102,241,0.2)] border-t-[var(--primary)] animate-[spin_0.8s_linear_infinite]" style={{ margin: '0 auto 12px' }} />
            <p className="text-muted">Loading applications…</p>
          </div>
        ) : applications.length === 0 ? (
          <div className="p-6 text-center text-[var(--text-muted)] sm:p-12">
            <IconCheck style={{ width: '40px', height: '40px', color: 'var(--success)', margin: '0 auto 12px' }} />
            <h4 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>
              Queue is Clear
            </h4>
            <p style={{ margin: 0, fontSize: '14px' }}>There are no pending organizer applications to review.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4 sm:gap-5 sm:p-6">
            {applications.map((app) => (
              <div className="p-4 sm:p-6"
                key={app.id}
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700 }}>{app.organizationName}</h4>
                    <span className="text-muted" style={{ fontSize: '13px' }}>
                      Applicant: {app.applicant.firstName} {app.applicant.lastName} ({app.applicant.email})
                    </span>
                  </div>
                  {app.status === 'PENDING' && <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px] [--button-px:12px] [--button-py:6px] [--button-font-size:13px] [--button-radius:var(--radius-sm)] text-[13px]"
                      onClick={() => void decide(app.id, 'APPROVED', app.organizationName)}
                    >
                      <IconCheck /> Approve Application
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)] [--button-px:12px] [--button-py:6px] [--button-font-size:13px] [--button-radius:var(--radius-sm)] text-[13px]"
                      style={{ color: 'var(--danger)' }}
                      onClick={() => setRejecting(app)}
                    >
                      <IconX /> Reject
                    </button>
                  </div>}
                </div>

                <div className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-4 text-[13px] min-[440px]:grid-cols-2 lg:grid-cols-3">
                  <div><strong>Contact:</strong> {app.contactName ?? 'N/A'} ({app.contactPhone ?? 'No phone'})</div>
                  <div><strong>Type:</strong> {app.organizerType?.replace(/_/g, ' ') ?? 'General'}</div>
                  <div><strong>Location:</strong> {[app.city, app.country].filter(Boolean).join(', ') || 'Unspecified'}</div>
                  <div>
                    <strong>Website:</strong>{' '}
                    {app.websiteUrl ? (
                      <a href={app.websiteUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                        Visit link <IconExternalLink style={{ width: '12px', height: '12px' }} />
                      </a>
                    ) : 'None'}
                  </div>
                  <div><strong>Categories:</strong> {app.eventCategories.map((c) => c.category.name).join(', ') || 'General'}</div>
                  <div><strong>Attendance:</strong> {app.expectedAttendance ? `${app.expectedAttendance.toLocaleString()} attendees` : 'N/A'}</div>
                </div>

                <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: 'var(--text-main)' }}>
                  <strong>Motivation & Plans:</strong> {app.description}
                </p>

                {app.experience && (
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                    <strong>Prior Experience:</strong> {app.experience}
                  </p>
                )}
                {app.status !== 'PENDING' && <p className="m-0 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600">Reviewed by {[app.reviewer?.firstName, app.reviewer?.lastName].filter(Boolean).join(' ') || app.reviewer?.email || 'an administrator'}{app.reviewedAt ? ` · ${new Date(app.reviewedAt).toLocaleString()}` : ''}{app.decisionNote ? ` · ${app.decisionNote}` : ''}</p>}
              </div>
            ))}
          </div>
        )}
        {!loading && <AdminPagination page={page} pageCount={pageData.pageCount} total={pageData.total} onPage={setPage} />}
      </section>
      <AdminNoteModal open={Boolean(rejecting)} title={`Reject ${rejecting?.organizationName ?? 'application'}?`} description="Give the applicant a clear reason so they understand the decision. This note will be included in their decision email and kept in the review record." label="Decision note" placeholder="Explain what needs to change or why the application cannot be approved." submitLabel="Reject application" onClose={() => setRejecting(null)} onSubmit={async (note) => { if (rejecting) await decide(rejecting.id, 'REJECTED', rejecting.organizationName, note) }} />
    </DashboardShell>
  )
}
