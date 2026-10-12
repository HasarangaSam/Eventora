import { AxiosError } from 'axios'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'

type CheckInResult = { outcome: 'CHECKED_IN' | 'ALREADY_CHECKED_IN' | 'INVALID' | 'WRONG_EVENT' | 'PAYMENT_UNCONFIRMED' | 'EVENT_CANCELLED'; reference?: string; ticketType?: string; checkedInAt?: string | null }
type Attendance = { event: { id: string; title: string }; summary: { totalIssued: number; checkedIn: number; remaining: number }; page: number; pageSize: number; records: Array<{ id: string; checkedInAt: string; method: string; reference: string; ticketType: string }> }

const messages: Record<CheckInResult['outcome'], string> = {
  CHECKED_IN: 'Ticket checked in successfully.',
  ALREADY_CHECKED_IN: 'This ticket has already been checked in.',
  INVALID: 'Ticket could not be validated. Check the QR code or reference and try again.',
  WRONG_EVENT: 'This ticket belongs to a different event.',
  PAYMENT_UNCONFIRMED: 'Payment is not confirmed for this ticket.',
  EVENT_CANCELLED: 'This event is cancelled, so tickets cannot be checked in.',
}

export function EventCheckinPage() {
  const { eventId = '' } = useParams()
  const request = useAuthenticatedApi()
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const handledRef = useRef(false)
  const [attendance, setAttendance] = useState<Attendance | null>(null)
  const [loadedEventId, setLoadedEventId] = useState('')
  const [reference, setReference] = useState('')
  const [result, setResult] = useState<CheckInResult | null>(null)
  const [error, setError] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [page, setPage] = useState(1)

  const refreshAttendance = useCallback(async (nextPage = page) => {
    const response = await request<Attendance>({ method: 'GET', url: `/organizer/events/${eventId}/check-ins`, params: { page: nextPage, pageSize: 25 } })
    setAttendance(response.data)
  }, [eventId, page, request])

  useEffect(() => {
    let active = true
    request<Attendance>({ method: 'GET', url: `/organizer/events/${eventId}/check-ins`, params: { page, pageSize: 25 } })
      .then((response) => { if (active) { setAttendance(response.data); setLoadedEventId(eventId); setError('') } })
      .catch(() => { if (active) { setLoadedEventId(eventId); setError('Attendance could not load. Confirm organizer access and retry.') } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [eventId, page, request])

  const checkIn = useCallback(async (value: string, method: 'QR_SCAN' | 'MANUAL_REFERENCE') => {
    if (!value.trim() || submitting) return
    setSubmitting(true); setResult(null); setError('')
    try {
      const response = await request<CheckInResult>({ method: 'POST', url: `/organizer/events/${eventId}/check-ins`, data: { value: value.trim(), method } })
      setResult(response.data)
      if (response.data.outcome === 'CHECKED_IN') {
        setReference('')
        setPage(1)
        await refreshAttendance(1)
      }
    } catch (reason) {
      setError(reason instanceof AxiosError && reason.response?.status === 403
        ? 'Organizer access is required to check in this event.'
        : 'Check-in could not be completed. Please try again.')
    } finally { setSubmitting(false) }
  }, [eventId, refreshAttendance, request, submitting])

  const attendanceLoading = loading || loadedEventId !== eventId

  useEffect(() => {
    if (!scanning || !videoRef.current) return
    let active = true
    handledRef.current = false
    setCameraError('')
    void import('@zxing/browser').then(({ BrowserQRCodeReader }) => {
      if (!active || !videoRef.current) return
      const reader = new BrowserQRCodeReader()
      return reader.decodeFromVideoDevice(undefined, videoRef.current, (decoded, _decodeError, controls) => {
        controlsRef.current = controls
        if (!active || !decoded || handledRef.current) return
        handledRef.current = true
        controls.stop()
        setScanning(false)
        void checkIn(decoded.getText(), 'QR_SCAN')
      })
    }).then((controls) => {
      if (!controls) return
      controlsRef.current = controls
      if (!active) controls.stop()
    }).catch(() => {
      if (active) { setCameraError('Camera could not start. Allow camera access or enter the ticket reference manually.'); setScanning(false) }
    })
    return () => { active = false; controlsRef.current?.stop(); controlsRef.current = null }
  }, [scanning, checkIn])

  function submitReference(event: FormEvent) {
    event.preventDefault()
    void checkIn(reference, 'MANUAL_REFERENCE')
  }

  return <main className="checkin-page">
    <Link className="text-button" to="/account">← Organizer workspace</Link>
    <span className="eyebrow">Organizer check-in</span>
    <h1>{attendanceLoading ? 'Loading event…' : attendance?.event.title ?? 'Event check-in'}</h1>
    <p className="checkin-intro">Scan an attendee’s ticket QR code or enter the printed reference. Camera access is requested only when you start scanning.</p>
    {error && <p className="checkin-message checkin-message--error" role="alert">{error}</p>}
    {result && <p className={`checkin-message${result.outcome === 'CHECKED_IN' ? ' checkin-message--success' : ''}`} role="status"><strong>{messages[result.outcome]}</strong>{result.reference && <span> {result.reference} · {result.ticketType}</span>}{result.checkedInAt && result.outcome === 'ALREADY_CHECKED_IN' && <span> Checked in {new Date(result.checkedInAt).toLocaleString()}.</span>}</p>}
    <div className="checkin-layout">
      <section className="checkin-card" aria-labelledby="validate-title">
        <h2 id="validate-title">Validate a ticket</h2>
        {!scanning ? <button className="button button--dark" type="button" disabled={submitting} onClick={() => { setCameraError(''); setScanning(true) }}>Start camera scanner</button> : <button className="button button--dark" type="button" onClick={() => setScanning(false)}>Stop scanner</button>}
        {cameraError && <p className="checkin-camera-error" role="status">{cameraError}</p>}
        {scanning && <video className="checkin-video" ref={videoRef} muted playsInline aria-label="Camera view for scanning event tickets" />}
        <p className="checkin-hint">Camera access requires a secure connection (HTTPS or localhost). Manual entry is always available.</p>
        <form className="checkin-form" onSubmit={submitReference}>
          <label htmlFor="ticket-reference">Ticket reference</label>
          <input id="ticket-reference" autoComplete="off" maxLength={32} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="EVT-…" />
          <button className="button button--small" type="submit" disabled={submitting || !reference.trim()}>{submitting ? 'Checking…' : 'Check in reference'}</button>
        </form>
      </section>
      <section className="checkin-card" aria-labelledby="attendance-title">
        <h2 id="attendance-title">Attendance</h2>
        {attendanceLoading ? <p>Loading attendance…</p> : attendance && <>
          <div className="checkin-summary"><div><strong>{attendance.summary.checkedIn}</strong><span>checked in</span></div><div><strong>{attendance.summary.totalIssued}</strong><span>confirmed tickets</span></div><div><strong>{attendance.summary.remaining}</strong><span>not checked in</span></div></div>
          {attendance.records.length ? <div className="checkin-records" aria-label="Recent check-ins">{attendance.records.map((record) => <div className="checkin-record" key={record.id}><div><strong>{record.reference}</strong><span>{record.ticketType} · {record.method === 'QR_SCAN' ? 'QR scan' : 'Manual entry'}</span></div><time dateTime={record.checkedInAt}>{new Date(record.checkedInAt).toLocaleString()}</time></div>)}</div> : <p className="checkin-hint">No tickets have been checked in yet.</p>}
          <div className="checkin-pagination"><button className="text-button" type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><span>Page {page}</span><button className="text-button" type="button" disabled={attendance.records.length < attendance.pageSize} onClick={() => setPage((current) => current + 1)}>Next</button></div>
        </>}
      </section>
    </div>
  </main>
}
