import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { DashboardShell } from '../analytics/dashboard-shell'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'

type Overview = {
  totalUsers: number; activeUsers: number; pendingApplications: number; registrationCount: number; confirmedRegistrations: number
  usersByRole: Record<string, number>; eventsByStatus: Record<string, number>; paymentsByStatus: Record<string, number>
  grossSales: { currency: string; amount: string; payments: number }[]; attendance: { checkedIn: number; issued: number; rate: number }
}

const card = 'rounded-xl border border-slate-200 bg-white shadow-sm'
const amount = (value: string, currency: string) => `${currency} ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function AdminOverviewPage() {
  const request = useAuthenticatedApi()
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    request<Overview>({ method: 'GET', url: '/admin/dashboard' })
      .then(({ data: response }) => { if (active) setData(response) })
      .catch(() => { if (active) setData(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [attempt, request])

  const eventCount = Object.values(data?.eventsByStatus ?? {}).reduce((sum, count) => sum + count, 0)
  const metrics = [
    { label: 'Accounts', value: data?.totalUsers ?? 0, detail: `${data?.activeUsers ?? 0} active` },
    { label: 'Events', value: eventCount, detail: `${data?.eventsByStatus.PUBLISHED ?? 0} published` },
    { label: 'Confirmed registrations', value: data?.confirmedRegistrations ?? 0, detail: `${data?.registrationCount ?? 0} total registrations` },
    { label: 'Tickets checked in', value: data?.attendance.checkedIn ?? 0, detail: `${data?.attendance.issued ?? 0} valid tickets issued` },
  ]

  return <DashboardShell role="ADMIN" pageTitle="Platform overview">
    <div className="space-y-6">
      <div><p className="mb-1 text-sm font-semibold text-indigo-700">ADMIN WORKSPACE</p><h1 className="m-0 text-2xl font-bold tracking-tight text-slate-900">Platform overview</h1><p className="mb-0 mt-2 text-sm text-slate-600">Review platform health and get to the work that needs attention.</p></div>

      {loading ? <section className={`${card} p-8 text-center text-sm text-slate-500`}>Loading platform totals…</section> : !data ? <section className={`${card} p-8 text-center`}><p className="m-0 text-sm text-slate-600">We couldn’t load the platform overview.</p><button onClick={() => setAttempt((value) => value + 1)} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Try again</button></section> : <>
        {data.pendingApplications > 0 && <Link to="/admin/applications" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 hover:border-amber-300"><div><strong className="text-sm text-amber-950">{data.pendingApplications} organizer {data.pendingApplications === 1 ? 'application needs' : 'applications need'} review</strong><p className="mb-0 mt-1 text-sm text-amber-800">Open the review queue to approve or decline applications.</p></div><span className="text-sm font-semibold text-amber-900">Review applications →</span></Link>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <div key={metric.label} className={`${card} p-5`}><p className="m-0 text-sm text-slate-500">{metric.label}</p><strong className="mt-2 block text-2xl font-bold tabular-nums text-slate-900">{metric.value.toLocaleString()}</strong><span className="mt-1 block text-xs text-slate-500">{metric.detail}</span></div>)}</section>

        <section className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
          <div className={`${card} overflow-hidden`}><div className="border-b border-slate-200 px-5 py-4"><h2 className="m-0 text-base font-bold text-slate-900">Events by status</h2><p className="mb-0 mt-1 text-sm text-slate-500">Current events across all organizers.</p></div><div className="divide-y divide-slate-100">{['PUBLISHED', 'DRAFT', 'COMPLETED', 'CANCELLED'].map((status) => <div key={status} className="flex items-center justify-between px-5 py-3"><span className="text-sm text-slate-700">{status[0] + status.slice(1).toLowerCase()}</span><strong className="tabular-nums text-slate-900">{(data.eventsByStatus[status] ?? 0).toLocaleString()}</strong></div>)}</div></div>
          <div className={`${card} overflow-hidden`}><div className="border-b border-slate-200 px-5 py-4"><h2 className="m-0 text-base font-bold text-slate-900">Verified ticket sales</h2><p className="mb-0 mt-1 text-sm text-slate-500">Confirmed payments, shown separately by currency.</p></div>{data.grossSales.length ? <div className="divide-y divide-slate-100">{data.grossSales.map((sale) => <div key={sale.currency} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"><div><strong className="text-base text-slate-900">{amount(sale.amount, sale.currency)}</strong><span className="ml-2 text-xs text-slate-500">{sale.payments} payments</span></div><Link to="/admin/payments" className="text-sm font-semibold text-indigo-700 hover:underline">Payments →</Link></div>)}</div> : <p className="p-5 text-sm text-slate-500">No verified ticket sales yet.</p>}</div>
        </section>

        <section className={`${card} p-5`}><h2 className="m-0 text-base font-bold text-slate-900">Admin tasks</h2><p className="mb-4 mt-1 text-sm text-slate-500">Open a section to review or manage platform records.</p><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[
          { to: '/admin/applications', title: 'Organizer applications', detail: `${data.pendingApplications} waiting for review` },
          { to: '/admin/events', title: 'Events', detail: 'Review event status and handle cancellations' },
          { to: '/admin/users', title: 'Accounts', detail: 'Manage account roles and access' },
          { to: '/admin/payments', title: 'Payments', detail: 'Review verified sales and payment attempts' },
          { to: '/admin/reports', title: 'Reports', detail: 'Follow registrations and attendance' },
          { to: '/admin/categories', title: 'Categories', detail: 'Manage event categories and visibility' },
        ].map((task) => <Link key={task.to} to={task.to} className="rounded-lg border border-slate-200 p-4 transition hover:border-indigo-300 hover:bg-slate-50"><strong className="block text-sm text-slate-900">{task.title}</strong><span className="mt-1 block text-sm text-slate-500">{task.detail}</span></Link>)}</div></section>
      </>}
    </div>
  </DashboardShell>
}
