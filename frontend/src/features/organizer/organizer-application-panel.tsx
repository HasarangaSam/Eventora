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
    async function loadRequirements() {
      try {
        const [appRes, catRes] = await Promise.all([
          request<Application[]>({ method: 'GET', url: '/organizer-applications/me' }),
          request<Category[]>({ method: 'GET', url: '/categories' }),
        ])
        if (active) {
          setApplications(appRes.data)
          setCategories(catRes.data)
        }
      } catch {
        if (active) toast.error('Load Error', 'Could not fetch organizer application requirements.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadRequirements()
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
    <section className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ padding: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none capitalize border border-[#c7d2fe] bg-[#eef2ff] text-[#4f46e5] [--badge-dot-color:#6366f1]" style={{ marginBottom: '8px' }}>
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
          <div className="h-8 w-8 rounded-full border-[3px] border-[rgba(99,102,241,0.2)] border-t-[var(--primary)] animate-[spin_0.8s_linear_infinite]" style={{ margin: '0 auto 8px' }} />
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
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none capitalize ${app.status === 'APPROVED' ? "border border-[#a7f3d0] bg-[#ecfdf5] text-[#059669] [--badge-dot-color:#10b981]" : app.status === 'REJECTED' ? "border border-[#fecaca] bg-[#fef2f2] text-[#dc2626] [--badge-dot-color:#ef4444]" : "border border-[#fde68a] bg-[#fffbeb] text-[#d97706] [--badge-dot-color:#f59e0b]"}`}
                >
                  <span className="h-[6px] w-[6px] rounded-full bg-[var(--badge-dot-color)]" />
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
              <div className="mb-[18px] grid grid-cols-3 gap-[18px]">
                <div className="mb-[18px] flex flex-col gap-1.5">
                  <label className="text-[13px] font-semibold text-[var(--text-main)]">Contact Name</label>
                  <input
                    required
                    className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  />
                </div>
                <div className="mb-[18px] flex flex-col gap-1.5">
                  <label className="text-[13px] font-semibold text-[var(--text-main)]">Verified Email</label>
                  <input className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]" value={email} readOnly disabled style={{ background: '#f1f5f9' }} />
                </div>
                <div className="mb-[18px] flex flex-col gap-1.5">
                  <label className="text-[13px] font-semibold text-[var(--text-main)]">Phone Number</label>
                  <input
                    required
                    type="tel"
                    className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    placeholder="+94 77 123 4567"
                  />
                </div>
              </div>

              <div className="mb-[18px] grid grid-cols-3 gap-[18px]">
                <div className="mb-[18px] flex flex-col gap-1.5">
                  <label className="text-[13px] font-semibold text-[var(--text-main)]">Organization Name</label>
                  <input
                    required
                    className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                    value={form.organizationName}
                    onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
                    placeholder="e.g. Colombo Tech Meetups"
                  />
                </div>
                <div className="mb-[18px] flex flex-col gap-1.5">
                  <label className="text-[13px] font-semibold text-[var(--text-main)]">Organization Type</label>
                  <select
                    className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
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
                <div className="mb-[18px] flex flex-col gap-1.5">
                  <label className="text-[13px] font-semibold text-[var(--text-main)]">Website / Social URL</label>
                  <input
                    type="url"
                    className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                    value={form.websiteUrl}
                    onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                    placeholder="https://"
                  />
                </div>
              </div>

              <div className="mb-[18px] grid grid-cols-2 gap-[18px]">
                <div className="mb-[18px] flex flex-col gap-1.5">
                  <label className="text-[13px] font-semibold text-[var(--text-main)]">Country</label>
                  <input
                    required
                    className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    placeholder="Sri Lanka"
                  />
                </div>
                <div className="mb-[18px] flex flex-col gap-1.5">
                  <label className="text-[13px] font-semibold text-[var(--text-main)]">City</label>
                  <input
                    required
                    className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Colombo"
                  />
                </div>
              </div>

              <h4 style={{ margin: '20px 0 12px', fontSize: '16px', fontWeight: 700 }}>Event Plans & Experience</h4>
              <div className="mb-[18px] flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-[var(--text-main)]">Why do you want to host events on Eventora?</label>
                <textarea
                  required
                  rows={3}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Tell us about the events you plan to produce…"
                />
              </div>

              <div className="mb-[18px] flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-[var(--text-main)]">Target Event Categories</label>
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

              <div className="mb-[18px] grid grid-cols-2 gap-[18px]">
                <div className="mb-[18px] flex flex-col gap-1.5">
                  <label className="text-[13px] font-semibold text-[var(--text-main)]">Expected Event Frequency</label>
                  <select
                    className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                    value={form.eventFrequency}
                    onChange={(e) => setForm({ ...form, eventFrequency: e.target.value })}
                  >
                    <option value="ONE_TIME">One Time</option>
                    <option value="OCCASIONALLY">Occasionally</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="FREQUENTLY">Frequently (Weekly)</option>
                  </select>
                </div>
                <div className="mb-[18px] flex flex-col gap-1.5">
                  <label className="text-[13px] font-semibold text-[var(--text-main)]">Typical Expected Attendance</label>
                  <input
                    required
                    type="number"
                    min="1"
                    className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                    value={form.expectedAttendance}
                    onChange={(e) => setForm({ ...form, expectedAttendance: e.target.value })}
                    placeholder="e.g. 150"
                  />
                </div>
              </div>

              <div className="mb-[18px] flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-[var(--text-main)]">Previous Event Organizing Experience</label>
                <textarea
                  required
                  rows={2}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
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
                className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px]"
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
