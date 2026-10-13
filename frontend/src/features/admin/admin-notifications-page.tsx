import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { DashboardShell } from '../analytics/dashboard-shell'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'

type NotificationItem = {
  id: string; type: string; title: string; message: string; createdAt: string; href: string; actionRequired: boolean; isRead: boolean
  location?: string; eventStatus?: string; actorRole?: string
}
type Notifications = { pendingApplications: number; notificationCount: number; unreadCount: number; periodDays: number; notifications: NotificationItem[] }

const panel = 'rounded-xl border border-slate-200 bg-white shadow-sm'
const dateLabel = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const typeLabel: Record<string, string> = {
  ORGANIZER_APPLICATION_PENDING: 'Application', EVENT_ADDED: 'New event', EVENT_CANCELLED: 'Event update', PAYMENT_EXCEPTION: 'Payment issue',
}

export function AdminNotificationsPage() {
  const request = useAuthenticatedApi()
  const [data, setData] = useState<Notifications | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true)
    request<Notifications>({ method: 'GET', url: '/admin/notifications' })
      .then(({ data: result }) => { if (active) setData(result) })
      .catch(() => { if (active) setData(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [attempt, request])

  const markRead = async (notificationIds: string[]) => {
    if (!notificationIds.length || saving) return
    setSaving(true)
    setActionError('')
    try {
      await request({ method: 'PATCH', url: '/admin/notifications/read', data: { notificationIds } })
      setAttempt((value) => value + 1)
      window.dispatchEvent(new Event('admin-notifications-updated'))
    } catch {
      setActionError('We couldn’t update the read status. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return <DashboardShell role="ADMIN" pageTitle="Notifications">
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-1 text-sm font-semibold text-indigo-700">PLATFORM UPDATES</p><h1 className="m-0 text-2xl font-bold text-slate-900">Notifications</h1><p className="mb-0 mt-2 text-sm text-slate-600">Recent activity and items that may need an admin review.</p></div><div className="flex gap-2">{data?.unreadCount ? <button disabled={saving} onClick={() => void markRead(data.notifications.filter((item) => !item.isRead).map((item) => item.id))} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{saving ? 'Saving…' : 'Mark all as read'}</button> : null}<button onClick={() => setAttempt((value) => value + 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Refresh</button></div></div>
      {actionError && <p role="alert" className="m-0 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{actionError}</p>}
      {loading ? <section className={`${panel} p-8 text-center text-sm text-slate-500`}>Loading notifications…</section> : !data ? <section className={`${panel} p-6`}><p className="m-0 text-sm text-rose-800">Notifications could not be loaded.</p><button onClick={() => setAttempt((value) => value + 1)} className="mt-3 text-sm font-semibold text-indigo-700 hover:underline">Try again</button></section> : <>
        <section className="grid gap-3 sm:grid-cols-2"><div className={`${panel} p-4`}><span className="text-sm text-slate-500">Organizer applications waiting</span><strong className="mt-1 block text-2xl text-slate-900">{data.pendingApplications.toLocaleString()}</strong><Link to="/admin/applications" className="mt-2 inline-flex text-sm font-semibold text-indigo-700 hover:underline">Open application queue →</Link></div><div className={`${panel} p-4`}><span className="text-sm text-slate-500">Recent activity</span><strong className="mt-1 block text-2xl text-slate-900">{data.notificationCount.toLocaleString()}</strong><span className="mt-2 block text-xs text-slate-500">Pending applications and updates from the last {data.periodDays} days</span></div></section>
        {data.notifications.length ? <section className={`${panel} overflow-hidden`}>
          <div className="border-b border-slate-200 px-5 py-4"><h2 className="m-0 text-base font-bold text-slate-900">Latest updates</h2><p className="mb-0 mt-1 text-sm text-slate-500">Pending applications, new or cancelled events, and payment exceptions.</p></div>
          <div className="divide-y divide-slate-100">{data.notifications.map((item) => <article key={item.id} className={`flex flex-wrap items-start justify-between gap-4 px-5 py-4 ${item.isRead ? 'bg-white hover:bg-slate-50' : 'bg-indigo-50/50 hover:bg-indigo-50'}`}>
            <div className="flex min-w-0 items-start gap-3"><span className={`mt-0.5 shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold ${item.actionRequired ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{typeLabel[item.type] ?? 'Update'}</span><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="m-0 text-sm font-semibold text-slate-900">{item.title}</h3>{!item.isRead && <span className="inline-flex h-2 w-2 rounded-full bg-indigo-600" aria-label="Unread" />}</div><p className="mb-0 mt-1 text-sm leading-5 text-slate-600">{item.message}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500"><span>{dateLabel(item.createdAt)}</span>{item.location && <span>{item.location}</span>}{item.eventStatus && <span>Status: {item.eventStatus.toLowerCase()}</span>}</div></div></div>
            <div className="flex shrink-0 items-center gap-3">{item.actionRequired && <span className="text-xs font-semibold text-amber-700">Review needed</span>}<Link to={item.href} className="text-sm font-semibold text-indigo-700 hover:underline">Open →</Link>{!item.isRead && <button disabled={saving} onClick={() => void markRead([item.id])} className="text-sm font-medium text-slate-600 hover:text-indigo-700 disabled:opacity-50">Mark read</button>}</div>
          </article>)}</div>
        </section> : <section className={`${panel} p-8 text-center`}><h2 className="m-0 text-lg font-bold text-slate-900">You’re all caught up</h2><p className="mt-2 text-sm text-slate-500">There are no pending applications or recent platform updates.</p></section>}
        <p className="m-0 text-xs text-slate-500">The list includes all pending organizer applications and activity from the last {data.periodDays} days. It refreshes when you open this page, return to the admin workspace, or select Refresh.</p>
      </>}
    </div>
  </DashboardShell>
}
