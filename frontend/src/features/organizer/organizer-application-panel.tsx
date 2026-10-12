import { AxiosError } from 'axios'
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { useToast } from '../../components/ui/toast'

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
  eventCategories: Array<{ category: { id: string; name: string } }>
  submittedAt: string
  decisionNote: string | null
}

interface Category {
  id: string
  name: string
}

interface Props {
  role: 'ATTENDEE' | 'ORGANIZER' | 'ADMIN'
  firstName: string | null
  lastName: string | null
  email: string
}

export function OrganizerApplicationPanel({ role, firstName, lastName, email }: Props) {
  const request = useAuthenticatedApi()
  const toast = useToast()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState({
    contactName: [firstName, lastName].filter(Boolean).join(' '),
    contactPhone: '',
    organizationName: '',
    organizerType: 'INDIVIDUAL',
    country: '',
    city: '',
    websiteUrl: '',
    description: '',
    categoryIds: [] as string[],
    experience: '',
    eventFrequency: 'ONE_TIME',
    expectedAttendance: '',
  })
  const [accuracyConfirmed, setAccuracyConfirmed] = useState(false)
  const [rulesAccepted, setRulesAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const { data } = await request<Application[]>({ method: 'GET', url: '/organizer-applications/me' })
      setApplications(data)
    } catch {
      toast.error('Applications Error', 'Could not load application status.')
    } finally {
      setLoading(false)
    }
  }, [request, toast])

  useEffect(() => {
    let active = true
    void Promise.all([
      request<Application[]>({ method: 'GET', url: '/organizer-applications/me' }),
      request<Category[]>({ method: 'GET', url: '/categories' }),
    ])
      .then(([appRes, catRes]) => {
        if (active) {
          setApplications(appRes.data)
          setCategories(catRes.data)
        }
      })
      .catch(() => {
        if (active) toast.error('Load Error', 'Could not fetch organizer application requirements.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [request, toast])

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await request({
        method: 'POST',
        url: '/organizer-applications',
        data: {
          ...form,
          expectedAttendance: Number(form.expectedAttendance),
          accuracyConfirmed,
          rulesAccepted,
        },
      })
      toast.success(
        'Application Submitted!',
        'Your organizer application is now queued for administrator review.',
      )
      setForm({
        ...form,
        contactPhone: '',
        organizationName: '',
        country: '',
        city: '',
        websiteUrl: '',
        description: '',
        categoryIds: [],
        experience: '',
        expectedAttendance: '',
      })
      setAccuracyConfirmed(false)
      setRulesAccepted(false)
      await refresh()
    } catch (error: unknown) {
      toast.error(
        'Submission Failed',
        error instanceof AxiosError && error.response?.status === 409
          ? 'You already have an application awaiting administrative decision.'
          : 'Could not submit application. Please review your entries.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (role !== 'ATTENDEE') return null
  const hasPending = applications.some((app) => app.status === 'PENDING')

  return (
    <section className="table-card" style={{ padding: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <span className="badge badge-indigo" style={{ marginBottom: '8px' }}>
          Host Events with Eventora
        </span>
        <h2 style={{ margin: '4px 0 6px', fontSize: '22px', fontWeight: 800 }}>
          Organizer Accreditation Application
        </h2>
        <p className="text-muted" style={{ margin: 0, fontSize: '14px' }}>
          Apply to publish ticketed events, manage sales, and check in attendees at your venue.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px' }}>
          <div className="spinner" style={{ margin: '0 auto 8px' }} />
          <p className="text-muted">Loading application history…</p>
        </div>
      ) : (
        <>
          {/* Previous Submissions */}
          {applications.map((app) => (
            <div
              key={app.id}
              style={{
                marginBottom: '24px',
                padding: '20px',
                background: '#f8fafc',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '16px' }}>{app.organizationName}</strong>
                <span
                  className={`badge ${
                    app.status === 'APPROVED' ? 'badge-emerald' : app.status === 'REJECTED' ? 'badge-rose' : 'badge-amber'
                  }`}
                >
                  <span className="badge-dot" />
                  {app.status.toLowerCase()}
                </span>
              </div>
              <p style={{ margin: '0 0 8px', fontSize: '14px', color: 'var(--text-muted)' }}>{app.description}</p>
              <span className="text-muted" style={{ fontSize: '12px' }}>
                Submitted on {new Date(app.submittedAt).toLocaleDateString()}
              </span>
              {app.decisionNote && (
                <div style={{ marginTop: '8px', padding: '8px 12px', background: '#ffffff', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
                  Review note: {app.decisionNote}
                </div>
              )}
            </div>
          ))}

          {/* New Application Form if no pending */}
          {!hasPending && (
            <form onSubmit={submit}>
              <h4 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Contact & Organization</h4>
              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">Contact Name</label>
                  <input
                    required
                    className="form-input"
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Verified Email</label>
                  <input className="form-input" value={email} readOnly disabled style={{ background: '#f1f5f9' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    required
                    type="tel"
                    className="form-input"
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    placeholder="+94 77 123 4567"
                  />
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">Organization Name</label>
                  <input
                    required
                    className="form-input"
                    value={form.organizationName}
                    onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
                    placeholder="e.g. Colombo Tech Meetups"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Organization Type</label>
                  <select
                    className="form-select"
                    value={form.organizerType}
                    onChange={(e) => setForm({ ...form, organizerType: e.target.value })}
                  >
                    <option value="INDIVIDUAL">Individual Host</option>
                    <option value="COMPANY">Registered Company</option>
                    <option value="EDUCATIONAL_INSTITUTION">Educational Institution</option>
                    <option value="NONPROFIT">Nonprofit / Charity</option>
                    <option value="OTHER">Other Community</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Website / Social URL</label>
                  <input
                    type="url"
                    className="form-input"
                    value={form.websiteUrl}
                    onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                    placeholder="https://"
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <input
                    required
                    className="form-input"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    placeholder="Sri Lanka"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input
                    required
                    className="form-input"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Colombo"
                  />
                </div>
              </div>

              <h4 style={{ margin: '20px 0 12px', fontSize: '16px', fontWeight: 700 }}>Event Plans & Experience</h4>
              <div className="form-group">
                <label className="form-label">Why do you want to host events on Eventora?</label>
                <textarea
                  required
                  rows={3}
                  className="form-textarea"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Tell us about the events you plan to produce…"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Target Event Categories</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {categories.map((cat) => (
                    <label
                      key={cat.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        background: form.categoryIds.includes(cat.id) ? '#eef2ff' : '#f8fafc',
                        border: '1px solid',
                        borderColor: form.categoryIds.includes(cat.id) ? 'var(--primary)' : 'var(--border)',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={form.categoryIds.includes(cat.id)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            categoryIds: e.target.checked
                              ? [...form.categoryIds, cat.id]
                              : form.categoryIds.filter((id) => id !== cat.id),
                          })
                        }
                      />
                      {cat.name}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Expected Event Frequency</label>
                  <select
                    className="form-select"
                    value={form.eventFrequency}
                    onChange={(e) => setForm({ ...form, eventFrequency: e.target.value })}
                  >
                    <option value="ONE_TIME">One Time</option>
                    <option value="OCCASIONALLY">Occasionally</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="FREQUENTLY">Frequently (Weekly)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Typical Expected Attendance</label>
                  <input
                    required
                    type="number"
                    min="1"
                    className="form-input"
                    value={form.expectedAttendance}
                    onChange={(e) => setForm({ ...form, expectedAttendance: e.target.value })}
                    placeholder="e.g. 150"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Previous Event Organizing Experience</label>
                <textarea
                  required
                  rows={2}
                  className="form-textarea"
                  value={form.experience}
                  onChange={(e) => setForm({ ...form, experience: e.target.value })}
                  placeholder="Briefly describe any past workshops, festivals, or meetups you have held…"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '18px 0' }}>
                <label style={{ display: 'flex', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    required
                    checked={accuracyConfirmed}
                    onChange={(e) => setAccuracyConfirmed(e.target.checked)}
                  />
                  I confirm the information in this application is accurate and true.
                </label>
                <label style={{ display: 'flex', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    required
                    checked={rulesAccepted}
                    onChange={(e) => setRulesAccepted(e.target.checked)}
                  />
                  I agree to honor published event terms, attendee privacy, and Eventora ticket policies.
                </label>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || categories.length === 0}
              >
                {submitting ? 'Submitting Application…' : 'Submit Application for Review'}
              </button>
            </form>
          )}
        </>
      )}
    </section>
  )
}
