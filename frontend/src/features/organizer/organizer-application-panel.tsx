import { AxiosError } from 'axios'
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'

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

interface Category { id: string; name: string }
interface Props { role: 'ATTENDEE' | 'ORGANIZER' | 'ADMIN'; firstName: string | null; lastName: string | null; email: string }

export function OrganizerApplicationPanel({ role, firstName, lastName, email }: Props) {
  const request = useAuthenticatedApi()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState({ contactName: [firstName, lastName].filter(Boolean).join(' '), contactPhone: '', organizationName: '', organizerType: 'INDIVIDUAL', country: '', city: '', websiteUrl: '', description: '', categoryIds: [] as string[], experience: '', eventFrequency: 'ONE_TIME', expectedAttendance: '' })
  const [accuracyConfirmed, setAccuracyConfirmed] = useState(false)
  const [rulesAccepted, setRulesAccepted] = useState(false)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const { data } = await request<Application[]>({ method: 'GET', url: '/organizer-applications/me' })
      setApplications(data)
      setMessage('')
    } catch {
      setMessage('We could not load your applications. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [request])

  useEffect(() => {
    let active = true
    void Promise.all([
      request<Application[]>({ method: 'GET', url: '/organizer-applications/me' }),
      request<Category[]>({ method: 'GET', url: '/categories' }),
    ])
      .then(([applicationResponse, categoryResponse]) => {
        if (active) { setApplications(applicationResponse.data); setCategories(categoryResponse.data) }
      })
      .catch(() => { if (active) setMessage('We could not load your applications. Please try again.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [request])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')
    try {
      await request({ method: 'POST', url: '/organizer-applications', data: { ...form, expectedAttendance: Number(form.expectedAttendance), accuracyConfirmed, rulesAccepted } })
      setForm({ ...form, contactName: [firstName, lastName].filter(Boolean).join(' '), contactPhone: '', organizationName: '', country: '', city: '', websiteUrl: '', description: '', categoryIds: [], experience: '', expectedAttendance: '' })
      setAccuracyConfirmed(false)
      setRulesAccepted(false)
      await refresh()
      setMessage('Your application was submitted for review.')
    } catch (error: unknown) {
      setMessage(error instanceof AxiosError && error.response?.status === 409
        ? 'You already have an application awaiting a decision.'
        : 'We could not submit your application. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (role !== 'ATTENDEE') return null
  const hasPending = applications.some((application) => application.status === 'PENDING')

  return <section className="application-section" aria-labelledby="application-title">
    <span className="eyebrow">Build experiences with Eventora</span>
    <h2 id="application-title">Organizer application</h2>
    {loading ? <p aria-live="polite">Loading your application history…</p> : <>
      {applications.map((application) => <article className="application-card" key={application.id}>
        <div><strong>{application.organizationName}</strong><span className={`application-status application-status--${application.status.toLowerCase()}`}>{application.status.toLowerCase()}</span></div>
        <p>{application.description}</p>
        {application.contactPhone && <small>Contact: {application.contactName} · {application.applicantEmail ?? email} · {application.contactPhone}</small>}
        {application.organizerType && <p>{application.organizerType.replaceAll('_', ' ').toLowerCase()} · {application.city}, {application.country}</p>}
        {application.eventCategories.length > 0 && <p>Event interests: {application.eventCategories.map(({ category }) => category.name).join(', ')}</p>}
        {application.experience && <p>Experience: {application.experience}</p>}
        {application.eventFrequency && <small>{application.eventFrequency.replaceAll('_', ' ').toLowerCase()} · typical attendance {application.expectedAttendance?.toLocaleString()}</small>}
        {application.websiteUrl && <p><a href={application.websiteUrl} target="_blank" rel="noreferrer">Website or social profile</a></p>}
        <small>Submitted {new Date(application.submittedAt).toLocaleDateString()}</small>
        {application.decisionNote && <p className="decision-note">Review note: {application.decisionNote}</p>}
      </article>)}
      {!hasPending && <form className="application-form organizer-application-form" onSubmit={submit}>
        <h3>Your contact details</h3>
        <label>Contact name<input required minLength={2} maxLength={200} autoComplete="name" value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} /></label>
        <label>Verified email address<input value={email} readOnly aria-describedby="application-email-note" /></label>
        <small id="application-email-note">This email comes from your signed-in Clerk account.</small>
        <label>Contact phone<input required type="tel" autoComplete="tel" minLength={7} maxLength={40} value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} /></label>
        <h3>Organization details</h3>
        <label>Organizer / organization name<input required minLength={2} maxLength={200} value={form.organizationName} onChange={(event) => setForm({ ...form, organizationName: event.target.value })} /></label>
        <label>Organizer type<select required value={form.organizerType} onChange={(event) => setForm({ ...form, organizerType: event.target.value })}><option value="INDIVIDUAL">Individual</option><option value="COMPANY">Company</option><option value="EDUCATIONAL_INSTITUTION">Educational institution</option><option value="NONPROFIT">Nonprofit</option><option value="OTHER">Other</option></select></label>
        <div className="application-location"><label>Country<input required autoComplete="country-name" maxLength={100} value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></label><label>City<input required autoComplete="address-level2" maxLength={120} value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label></div>
        <label>Website or social media URL <span>(optional)</span><input type="url" maxLength={2048} value={form.websiteUrl} onChange={(event) => setForm({ ...form, websiteUrl: event.target.value })} placeholder="https://" /></label>
        <h3>Event plans and experience</h3>
        <label>Why do you want to become an Eventora organizer?<textarea required minLength={20} maxLength={5000} rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <fieldset className="application-categories"><legend>What types of events will you organize? Select one or more.</legend>{categories.map((category) => <label key={category.id}><input type="checkbox" checked={form.categoryIds.includes(category.id)} onChange={(event) => setForm({ ...form, categoryIds: event.target.checked ? [...form.categoryIds, category.id] : form.categoryIds.filter((id) => id !== category.id) })} />{category.name}</label>)}{categories.length === 0 && <small>Event categories are currently unavailable.</small>}</fieldset>
        <label>Previous event-organizing experience <span>(include “I’m a beginner” if applicable)</span><textarea required minLength={10} maxLength={5000} rows={4} value={form.experience} onChange={(event) => setForm({ ...form, experience: event.target.value })} /></label>
        <label>Expected event frequency<select required value={form.eventFrequency} onChange={(event) => setForm({ ...form, eventFrequency: event.target.value })}><option value="ONE_TIME">One time</option><option value="OCCASIONALLY">Occasionally</option><option value="MONTHLY">Monthly</option><option value="FREQUENTLY">Frequently</option></select></label>
        <label>Typical expected attendance<input required type="number" min="1" max="1000000" step="1" value={form.expectedAttendance} onChange={(event) => setForm({ ...form, expectedAttendance: event.target.value })} /></label>
        <label className="application-agreement"><input required type="checkbox" checked={accuracyConfirmed} onChange={(event) => setAccuracyConfirmed(event.target.checked)} />I confirm the information in this application is accurate.</label>
        <label className="application-agreement"><input required type="checkbox" checked={rulesAccepted} onChange={(event) => setRulesAccepted(event.target.checked)} /><span>I accept Eventora’s organizer rules: I will provide accurate event details, honor published ticket terms, protect attendee information, and follow Eventora’s event cancellation and payment rules.</span></label>
        <p className="application-privacy-note">No identity documents or business-registration documents are required.</p>
        <button className="button button--dark" disabled={submitting || categories.length === 0} type="submit">{submitting ? 'Submitting…' : 'Submit for admin review'}</button>
      </form>}
    </>}
    {message && <p aria-live="polite" role="status">{message}</p>}
  </section>
}
