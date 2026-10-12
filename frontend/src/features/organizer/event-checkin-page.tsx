import { AxiosError } from 'axios'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import { metricCardClass, metricsGridClass, metricHintClass, metricLabelClass, metricValueClass } from '../../components/ui/metric-card-classes'
import { useToast } from '../../components/ui/toast'
import {
  IconCamera,
  IconCheck,
  IconAlertCircle,
} from '../../components/ui/icons'

type CheckInResult = {
  outcome: 'CHECKED_IN' | 'ALREADY_CHECKED_IN' | 'INVALID' | 'WRONG_EVENT' | 'PAYMENT_UNCONFIRMED' | 'EVENT_CANCELLED'
  reference?: string
  ticketType?: string
  checkedInAt?: string | null
}

type Attendance = {
  event: { id: string; title: string }
  summary: { totalIssued: number; checkedIn: number; remaining: number }
  page: number
  pageSize: number
  records: Array<{ id: string; checkedInAt: string; method: string; reference: string; ticketType: string }>
}

const outcomeMessages: Record<CheckInResult['outcome'], string> = {
  CHECKED_IN: 'Ticket Validated Successfully! Welcome to the event.',
  ALREADY_CHECKED_IN: 'Warning: This ticket was already checked in.',
  INVALID: 'Invalid Ticket. Code not recognized.',
  WRONG_EVENT: 'Wrong Event. Ticket belongs to a different event.',
  PAYMENT_UNCONFIRMED: 'Payment Unconfirmed for this ticket.',
  EVENT_CANCELLED: 'This event was cancelled. Check-in closed.',
}

export function EventCheckinPage() {
  const { eventId = '' } = useParams()
  const request = useAuthenticatedApi()
  const toast = useToast()
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const handledRef = useRef(false)

  const [attendance, setAttendance] = useState<Attendance | null>(null)
  const [reference, setReference] = useState('')
  const [result, setResult] = useState<CheckInResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [page, setPage] = useState(1)

  const refreshAttendance = useCallback(
    async (nextPage = page) => {
      try {
        const response = await request<Attendance>({
          method: 'GET',
          url: `/organizer/events/${eventId}/check-ins`,
          params: { page: nextPage, pageSize: 25 },
        })
        setAttendance(response.data)
      } catch {
        toast.error('Attendance Load Failed', 'Could not refresh check-in roster.')
      }
    },
    [eventId, page, request, toast],
  )

  useEffect(() => {
    let active = true
    async function loadAttendance() {
      try {
        const res = await request<Attendance>({
          method: 'GET',
          url: `/organizer/events/${eventId}/check-ins`,
          params: { page, pageSize: 25 },
        })
        if (active) setAttendance(res.data)
      } catch {
        if (active) toast.error('Attendance Error', 'Confirm organizer access for this event.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadAttendance()
    return () => {
      active = false
    }
  }, [eventId, page, request, toast])

  const checkIn = useCallback(
    async (value: string, method: 'QR_SCAN' | 'MANUAL_REFERENCE') => {
      if (!value.trim() || submitting) return
      setSubmitting(true)
      setResult(null)
      try {
        const response = await request<CheckInResult>({
          method: 'POST',
          url: `/organizer/events/${eventId}/check-ins`,
          data: { value: value.trim(), method },
        })
        setResult(response.data)

        if (response.data.outcome === 'CHECKED_IN') {
          toast.success('Admitted!', `${response.data.reference} (${response.data.ticketType}) checked in.`)
          setReference('')
          setPage(1)
          await refreshAttendance(1)
        } else if (response.data.outcome === 'ALREADY_CHECKED_IN') {
          toast.warning('Duplicate Scan', outcomeMessages[response.data.outcome])
        } else {
          toast.error('Check-in Rejected', outcomeMessages[response.data.outcome])
        }
      } catch (reason) {
        toast.error(
          'Check-in Failed',
          reason instanceof AxiosError && reason.response?.status === 403
            ? 'Organizer authorization is required for this event.'
            : 'Server could not validate check-in.',
        )
      } finally {
        setSubmitting(false)
      }
    },
    [eventId, refreshAttendance, request, submitting, toast],
  )

  useEffect(() => {
    if (!scanning || !videoRef.current) return
    let active = true
    handledRef.current = false

    async function startScanner() {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser')
        if (!active || !videoRef.current) return
        const reader = new BrowserQRCodeReader()
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (decoded, _err, controls) => {
          controlsRef.current = controls
          if (!active || !decoded || handledRef.current) return
          handledRef.current = true
          controls.stop()
          setScanning(false)
          void checkIn(decoded.getText(), 'QR_SCAN')
        })
        if (!controls) return
        controlsRef.current = controls
        if (!active) controls.stop()
      } catch {
        if (active) {
          toast.error('Camera Error', 'Camera could not be accessed. Allow camera permission or use manual reference entry.')
          setScanning(false)
        }
      }
    }
    void startScanner()

    return () => {
      active = false
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [scanning, checkIn, toast])

  function submitReference(e: FormEvent) {
    e.preventDefault()
    void checkIn(reference, 'MANUAL_REFERENCE')
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Console Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <Link to="/account" className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border-0 bg-transparent px-2 py-1 text-[13px] font-semibold text-[var(--text-button-color,var(--primary))] cursor-pointer transition-[all] duration-150 hover:bg-[var(--text-button-bg,var(--primary-light))] hover:text-[var(--text-button-hover,var(--primary-hover))]" style={{ marginBottom: '8px' }}>
            ← Back to Organizer Studio
          </Link>
          <h2 style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: 800 }}>
            {loading ? 'Loading Event…' : attendance?.event.title ?? 'Door Check-in Console'}
          </h2>
          <span className="text-muted" style={{ fontSize: '14px' }}>
            Live attendee QR scanning and manual entry verification
          </span>
        </div>
      </div>

      {/* KPI Stats Strip */}
      {attendance && (
        <div className={metricsGridClass}>
          <div className={metricCardClass}>
            <span className={metricLabelClass}>Checked In</span>
            <strong className={metricValueClass} style={{ color: 'var(--success)' }}>
              {attendance.summary.checkedIn}
            </strong>
            <span className={metricHintClass}>Attendees inside venue</span>
          </div>
          <div className={metricCardClass}>
            <span className={metricLabelClass}>Remaining</span>
            <strong className={metricValueClass} style={{ color: 'var(--primary)' }}>
              {attendance.summary.remaining}
            </strong>
            <span className={metricHintClass}>Expected arrivals</span>
          </div>
          <div className={metricCardClass}>
            <span className={metricLabelClass}>Total Issued</span>
            <strong className={metricValueClass}>{attendance.summary.totalIssued}</strong>
            <span className={metricHintClass}>Confirmed registrations</span>
          </div>
        </div>
      )}

      {/* Result Status Banner */}
      {result && (
        <div
          className="flex w-full max-w-none items-start gap-3 rounded-[var(--radius-md)] border-l-4 bg-white px-[18px] py-3.5 shadow-[0_10px_25px_-5px_rgba(15,23,42,0.2),0_8px_10px_-6px_rgba(15,23,42,0.1)]"
          style={{ borderLeftColor: result.outcome === 'CHECKED_IN' ? 'var(--success)' : result.outcome === 'ALREADY_CHECKED_IN' ? 'var(--warning)' : 'var(--danger)' }}
        >
          <div className={`mt-px h-5 w-5 shrink-0 ${result.outcome === 'CHECKED_IN' ? 'text-[var(--success)]' : result.outcome === 'ALREADY_CHECKED_IN' ? 'text-[var(--warning)]' : 'text-[var(--danger)]'}`}>
            {result.outcome === 'CHECKED_IN' ? <IconCheck /> : <IconAlertCircle />}
          </div>
          <div className="flex-1">
            <strong className="block text-base leading-[1.3] font-semibold text-[var(--text-main)]">
              {outcomeMessages[result.outcome]}
            </strong>
            {result.reference && (
              <p className="mt-1 text-[13px] leading-[1.4] text-[var(--text-muted)]">
                Reference: <code>{result.reference}</code> · {result.ticketType}
                {result.checkedInAt && result.outcome === 'ALREADY_CHECKED_IN' && (
                  <> · Originally admitted {new Date(result.checkedInAt).toLocaleTimeString()}</>
                )}
              </p>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>
        {/* Scanner & Manual Entry Card */}
        <div className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ margin: 0, padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '18px' }}>Scanner & Entry</h3>

          <div style={{ marginBottom: '24px' }}>
            {!scanning ? (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px]"
                style={{ width: '100%', padding: '16px' }}
                onClick={() => setScanning(true)}
              >
                <IconCamera /> Start Live Camera Scanner
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)]"
                style={{ width: '100%', padding: '16px' }}
                onClick={() => setScanning(false)}
              >
                Stop Camera Scanner
              </button>
            )}

            {scanning && (
              <div
                style={{
                  marginTop: '16px',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  background: '#000000',
                  aspectRatio: '4 / 3',
                  position: 'relative',
                  border: '2px solid var(--primary)',
                }}
              >
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '60%',
                    height: '60%',
                    border: '2px dashed #ffffff',
                    borderRadius: '12px',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600 }}>Manual Ticket Reference</h4>
            <form onSubmit={submitReference} style={{ display: 'flex', gap: '10px' }}>
              <input
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                maxLength={32}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. EVT-ABCD-1234"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)]"
                disabled={submitting || !reference.trim()}
              >
                {submitting ? 'Checking…' : 'Admit'}
              </button>
            </form>
          </div>
        </div>

        {/* Live Admission Roster */}
        <div className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ margin: 0 }}>
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5 [&_h3]:m-0 [&_h3]:text-lg [&_h3]:font-bold">
            <h3>Recent Check-ins</h3>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none capitalize border border-slate-200 bg-slate-100 text-slate-600 [--badge-dot-color:#64748b]">{attendance?.records.length ?? 0} entries</span>
          </div>

          <div style={{ maxHeight: '420px', overflowY: 'auto', padding: '12px' }}>
            {attendance?.records.map((rec) => (
              <div
                key={rec.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div>
                  <strong style={{ fontSize: '14px', display: 'block' }}>{rec.reference}</strong>
                  <span className="text-muted" style={{ fontSize: '12px' }}>
                    {rec.ticketType} · {rec.method === 'QR_SCAN' ? 'Camera Scan' : 'Manual'}
                  </span>
                </div>
                <time style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {new Date(rec.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </time>
              </div>
            ))}
            {!attendance?.records.length && (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No attendees admitted yet.
              </div>
            )}
          </div>

          {attendance && (
            <div
              style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '13px',
              }}
            >
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border-0 bg-transparent px-2 py-1 text-[13px] font-semibold text-[var(--text-button-color,var(--primary))] cursor-pointer transition-[all] duration-150 hover:bg-[var(--text-button-bg,var(--primary-light))] hover:text-[var(--text-button-hover,var(--primary-hover))]"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span>Page {page}</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border-0 bg-transparent px-2 py-1 text-[13px] font-semibold text-[var(--text-button-color,var(--primary))] cursor-pointer transition-[all] duration-150 hover:bg-[var(--text-button-bg,var(--primary-light))] hover:text-[var(--text-button-hover,var(--primary-hover))]"
                disabled={attendance.records.length < attendance.pageSize}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
