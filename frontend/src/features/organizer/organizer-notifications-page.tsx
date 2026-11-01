import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { DashboardShell } from '../analytics/dashboard-shell'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'
import {
  IconCheck,
  IconAlertCircle,
  IconAlertTriangle,
  IconTicket,
  IconRefresh,
} from '../../components/ui/icons'
import type { ReactElement, SVGProps } from 'react'

type NotificationItem = {
  id: string
  type: string
  title: string
  message: string
  createdAt: string
  href: string
  actionRequired: boolean
  isRead: boolean
  eventTitle?: string
  detail?: string
}
type NotificationsResponse = { unreadCount: number; notificationCount: number; periodDays: number; notifications: NotificationItem[] }
type Filter = 'ALL' | 'UNREAD' | 'ACTION'

const panel = 'rounded-xl border border-slate-200 bg-white shadow-sm'
const dateLabel = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

const typeConfig: Record<string, { label: string; icon: (props: SVGProps<SVGSVGElement>) => ReactElement; iconBg: string; iconColor: string; badgeBg: string; badgeText: string }> = {
  BOOKING_CONFIRMED: { label: 'New booking', icon: IconCheck, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', badgeBg: 'bg-emerald-50', badgeText: 'text-emerald-700' },
  PAYMENT_REVIEW:   { label: 'Payment issue', icon: IconAlertCircle, iconBg: 'bg-rose-50', iconColor: 'text-rose-600', badgeBg: 'bg-rose-50', badgeText: 'text-rose-700' },
  EVENT_CANCELLED:  { label: 'Event update', icon: IconAlertTriangle, iconBg: 'bg-amber-50', iconColor: 'text-amber-600', badgeBg: 'bg-amber-50', badgeText: 'text-amber-700' },
  CAPACITY_NEAR:    { label: 'Nearly full', icon: IconTicket, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', badgeBg: 'bg-indigo-50', badgeText: 'text-indigo-700' },
}

const defaultConfig = { label: 'Update', icon: IconAlertCircle, iconBg: 'bg-slate-50', iconColor: 'text-slate-500', badgeBg: 'bg-slate-100', badgeText: 'text-slate-600' }

export function OrganizerNotificationsPage() {
  const request = useAuthenticatedApi()
  const [data, setData] = useState<NotificationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<Filter>('ALL')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    request<NotificationsResponse>({ method: 'GET', url: '/organizer/notifications' })
      .then(({ data: result }) => { if (active) setData(result) })
      .catch(() => { if (active) setData(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [attempt, request])

  const visibleItems = useMemo(() => (data?.notifications ?? []).filter((item) => {
    if (filter === 'UNREAD') return !item.isRead
    if (filter === 'ACTION') return item.actionRequired
    return true
  }), [data, filter])

  const markRead = async (ids: string[]) => {
    if (!ids.length || saving) return
    setSaving(true)
    setError('')
    try {
      await request({ method: 'PATCH', url: '/organizer/notifications/read', data: { notificationIds: ids } })
      setAttempt((value) => value + 1)
      window.dispatchEvent(new Event('organizer-notifications-updated'))
    } catch {
      setError('We couldn\'t update the read status. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const filters: Array<{ id: Filter; label: string }> = [
    { id: 'ALL', label: `All updates${data ? ` · ${data.notificationCount}` : ''}` },
    { id: 'UNREAD', label: `Unread${data ? ` · ${data.unreadCount}` : ''}` },
    { id: 'ACTION', label: 'Needs attention' },
  ]

  return (
    <DashboardShell role="ORGANIZER" pageTitle="Notifications">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-sm font-semibold text-indigo-700">YOUR EVENTS</p>
            <h1 className="m-0 text-2xl font-bold text-slate-900">Notifications</h1>
            <p className="mb-0 mt-2 text-sm text-slate-600">Bookings, payment issues, event updates, and sales milestones for your events.</p>
          </div>
          <div className="flex gap-2">
            {data?.unreadCount ? (
              <button
                disabled={saving}
                onClick={() => void markRead(data.notifications.filter((item) => !item.isRead).map((item) => item.id))}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Mark all as read'}
              </button>
            ) : null}
            <button
              onClick={() => setAttempt((value) => value + 1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <IconRefresh className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {error && <p role="alert" className="m-0 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

        {loading ? (
          <section className={`${panel} p-8 text-center text-sm text-slate-500`}>Loading updates…</section>
        ) : !data ? (
          <section className={`${panel} p-6`}>
            <p className="m-0 text-sm text-rose-800">We couldn't load your notifications.</p>
            <button onClick={() => setAttempt((value) => value + 1)} className="mt-3 text-sm font-semibold text-indigo-700 hover:underline">
              Try again
            </button>
          </section>
        ) : (
          <>
            {/* KPI Cards */}
            <section className="grid gap-3 sm:grid-cols-3">
              <div className={`${panel} p-4`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Unread updates</span>
                  {data.unreadCount > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">{data.unreadCount}</span>}
                </div>
                <strong className="mt-1 block text-2xl text-slate-900">{data.unreadCount.toLocaleString()}</strong>
                <span className="mt-2 block text-xs text-slate-500">Updates you haven't marked as read</span>
              </div>
              <div className={`${panel} p-4`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Needs attention</span>
                  {data.notifications.filter((item) => item.actionRequired).length > 0 && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                      {data.notifications.filter((item) => item.actionRequired).length}
                    </span>
                  )}
                </div>
                <strong className="mt-1 block text-2xl text-slate-900">{data.notifications.filter((item) => item.actionRequired).length.toLocaleString()}</strong>
                <span className="mt-2 block text-xs text-slate-500">Payment, capacity, and event issues</span>
              </div>
              <div className={`${panel} p-4`}>
                <span className="text-sm text-slate-500">Recent updates</span>
                <strong className="mt-1 block text-2xl text-slate-900">{data.notificationCount.toLocaleString()}</strong>
                <span className="mt-2 block text-xs text-slate-500">From the last {data.periodDays} days</span>
              </div>
            </section>

            {/* Notification list */}
            <section className={`${panel} overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="m-0 text-base font-bold text-slate-900">Latest updates</h2>
                  <p className="mb-0 mt-1 text-sm text-slate-500">Updates only include events you manage.</p>
                </div>
                <div className="flex flex-wrap gap-1" role="group" aria-label="Filter notifications">
                  {filters.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setFilter(item.id)}
                      aria-pressed={filter === item.id}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 aria-pressed:bg-indigo-50 aria-pressed:text-indigo-700"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {visibleItems.length ? (
                <div className="divide-y divide-slate-100">
                  {visibleItems.map((item) => {
                    const config = typeConfig[item.type] ?? defaultConfig
                    const Icon = config.icon
                    return (
                      <article
                        key={item.id}
                        className={`flex flex-wrap items-start justify-between gap-4 px-5 py-4 ${item.isRead ? 'bg-white hover:bg-slate-50' : 'bg-indigo-50/40 hover:bg-indigo-50'}`}
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          {/* Icon */}
                          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.iconBg} ${config.iconColor}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          {/* Content */}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${config.badgeBg} ${config.badgeText}`}>
                                {config.label}
                              </span>
                              {item.actionRequired && (
                                <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                  Action needed
                                </span>
                              )}
                              {!item.isRead && (
                                <span className="inline-flex h-2 w-2 rounded-full bg-indigo-600" aria-label="Unread" />
                              )}
                            </div>
                            <h3 className="m-0 mt-1 text-sm font-semibold text-slate-900">{item.title}</h3>
                            <p className="mb-0 mt-1 text-sm leading-5 text-slate-600">{item.message}</p>
                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                              <span>{dateLabel(item.createdAt)}</span>
                              {item.detail && <span>{item.detail}</span>}
                              {item.eventTitle && <span className="font-medium text-slate-600">{item.eventTitle}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          <Link to={item.href} className="text-sm font-semibold text-indigo-700 hover:underline">
                            {item.type === 'BOOKING_CONFIRMED' ? 'View participants' : 'Open event'} →
                          </Link>
                          {!item.isRead && (
                            <button
                              disabled={saving}
                              onClick={() => void markRead([item.id])}
                              className="text-xs font-medium text-slate-500 hover:text-indigo-700 disabled:opacity-50"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              ) : (
                <div className="p-10 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <IconCheck className="h-6 w-6" />
                  </div>
                  <h3 className="m-0 mt-3 text-base font-semibold text-slate-900">
                    {filter === 'UNREAD' ? 'You\'re all caught up' : filter === 'ACTION' ? 'Nothing needs attention' : 'No recent updates'}
                  </h3>
                  <p className="mb-0 mt-2 text-sm text-slate-500">
                    {filter === 'ALL' ? 'New bookings and event updates will appear here.' : 'Try another filter to see more updates.'}
                  </p>
                  {filter !== 'ALL' && (
                    <button
                      onClick={() => setFilter('ALL')}
                      className="mt-3 text-sm font-semibold text-indigo-700 hover:underline"
                    >
                      Show all updates
                    </button>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  )
}
