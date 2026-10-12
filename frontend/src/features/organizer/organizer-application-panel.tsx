import { AxiosError } from 'axios'
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'

interface Application {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  organizationName: string
  description: string
  submittedAt: string
  decisionNote: string | null
}

interface Props { role: 'ATTENDEE' | 'ORGANIZER' | 'ADMIN' }

export function OrganizerApplicationPanel({ role }: Props) {
  const request = useAuthenticatedApi()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [organizationName, setOrganizationName] = useState('')
  const [description, setDescription] = useState('')
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
    void request<Application[]>({ method: 'GET', url: '/organizer-applications/me' })
      .then(({ data }) => { if (active) setApplications(data) })
      .catch(() => { if (active) setMessage('We could not load your applications. Please try again.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [request])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')
    try {
      await request({ method: 'POST', url: '/organizer-applications', data: { organizationName, description } })
      setOrganizationName('')
      setDescription('')
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
        <small>Submitted {new Date(application.submittedAt).toLocaleDateString()}</small>
        {application.decisionNote && <p className="decision-note">Review note: {application.decisionNote}</p>}
      </article>)}
      {!hasPending && <form className="application-form" onSubmit={submit}>
        <label>Organization name<input required minLength={2} maxLength={200} value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} /></label>
        <label>Tell us about your events<textarea required minLength={20} maxLength={5000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <button className="button button--dark" disabled={submitting} type="submit">{submitting ? 'Submitting…' : 'Submit application'}</button>
      </form>}
    </>}
    {message && <p aria-live="polite" role="status">{message}</p>}
  </section>
}
