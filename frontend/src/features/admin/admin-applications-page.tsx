import { useCallback, useEffect, useState } from 'react'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { DashboardShell } from '../analytics/dashboard-shell'
import { useToast } from '../../components/ui/toast'
import { IconCheck, IconX, IconExternalLink, IconSearch } from '../../components/ui/icons'

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
  applicant: { id: string; email: string; firstName: string | null; lastName: string | null }
}

export function AdminApplicationsPage() {
  const request = useAuthenticatedApi()
  const toast = useToast()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const loadApplications = useCallback(async () => {
    setLoading(true)
    try {
      const response = await request<Application[]>({
        method: 'GET',
        url: '/organizer-applications?status=PENDING',
      })
      setApplications(response.data)
    } catch {
      toast.error('Load Error', 'Could not load organizer applications.')
    } finally {
      setLoading(false)
    }
  }, [request, toast])

  useEffect(() => {
    void loadApplications()
  }, [loadApplications])

  async function decide(id: string, status: 'APPROVED' | 'REJECTED', orgName: string) {
    try {
      await request({ method: 'PATCH', url: `/organizer-applications/${id}/decision`, data: { status } })
      toast.success(
        status === 'APPROVED' ? 'Application Approved' : 'Application Rejected',
        `${orgName} has been ${status.toLowerCase()}.`,
      )
      await loadApplications()
    } catch {
      toast.error('Decision Failed', 'The decision could not be recorded. Please try again.')
    }
  }

  const filtered = applications.filter((app) =>
    `${app.organizationName} ${app.applicant.email} ${app.contactName ?? ''}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )

  return (
    <DashboardShell role="ADMIN" pageTitle="Organizer Accreditation Queue">
      <section className="table-card" style={{ margin: 0 }}>
        <div className="table-header" style={{ flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3>Pending Applications ({applications.length})</h3>
            <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
              Carefully review organizations applying to host and sell tickets on Eventora.
            </p>
          </div>

          <div style={{ position: 'relative' }}>
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
              className="form-input"
              style={{ paddingLeft: '36px', width: '260px' }}
              placeholder="Search organization or email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <p className="text-muted">Loading applications…</p>
          </div>
        ) : applications.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <IconCheck style={{ width: '40px', height: '40px', color: 'var(--success)', margin: '0 auto 12px' }} />
            <h4 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>
              Queue is Clear
            </h4>
            <p style={{ margin: 0, fontSize: '14px' }}>There are no pending organizer applications to review.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No applications match your search query.
          </div>
        ) : (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {filtered.map((app) => (
              <div
                key={app.id}
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '24px',
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
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => void decide(app.id, 'APPROVED', app.organizationName)}
                    >
                      <IconCheck /> Approve Application
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ color: 'var(--danger)' }}
                      onClick={() => void decide(app.id, 'REJECTED', app.organizationName)}
                    >
                      <IconX /> Reject
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                    fontSize: '13px',
                    background: '#ffffff',
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                  }}
                >
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
              </div>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  )
}
