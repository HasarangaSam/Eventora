import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { DashboardShell } from '../analytics/dashboard-shell'
import { useAuthenticatedApi } from '../auth/use-authenticated-api'

const panel = 'rounded-xl border border-slate-200 bg-white shadow-sm'
const money = (amount: string, currency: string) => `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const monthLabel = (value: string) => new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-01T00:00:00Z`))

type PaymentReport = {
  byStatus: { status: string; currency: string; count: number; amount: string }[]
  verifiedGross: { currency: string; count: number; amount: string }[]
}
type ActivityReport = {
  registrations: { months: { month: string; created: number; confirmed: number }[] }
  attendance: { issued: number; checkedIn: number; rate: number }
  sales: { months: { month: string; grossSales: { currency: string; amount: string; payments: number }[] }[] }
}

export function AdminPaymentsPage() {
  const request = useAuthenticatedApi()
  const [report, setReport] = useState<PaymentReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    request<PaymentReport>({ method: 'GET', url: '/admin/analytics/payments' }).then(({ data }) => { if (active) setReport(data) })
      .catch(() => { if (active) setError(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [attempt, request])

  return <DashboardShell role="ADMIN" pageTitle="Payments">
    <div className="space-y-5"><div><p className="mb-1 text-sm font-semibold text-indigo-700">PLATFORM FINANCE</p><h1 className="m-0 text-2xl font-bold text-slate-900">Payments</h1><p className="mb-0 mt-2 text-sm text-slate-600">Review confirmed ticket sales and payment attempts by status.</p></div>
      {loading ? <div className={`${panel} p-8 text-center text-sm text-slate-500`}>Loading payment totals…</div> : error || !report ? <div className={`${panel} p-6 text-sm text-rose-800`}>Payment information could not be loaded. <button className="font-semibold underline" onClick={() => { setError(false); setAttempt((value) => value + 1) }}>Try again</button></div> : <>
        <section className={`${panel} overflow-hidden`}><div className="border-b border-slate-200 px-5 py-4"><h2 className="m-0 text-base font-bold text-slate-900">Verified ticket sales</h2><p className="mb-0 mt-1 text-sm text-slate-500">Only successful payments confirmed by the payment provider are included.</p></div>{report.verifiedGross.length ? <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">{report.verifiedGross.map((row) => <div key={row.currency} className="rounded-lg bg-slate-50 p-4"><span className="text-sm text-slate-500">{row.currency}</span><strong className="mt-1 block text-xl text-slate-900">{money(row.amount, row.currency)}</strong><span className="mt-1 block text-xs text-slate-500">{row.count.toLocaleString()} confirmed payments</span></div>)}</div> : <p className="p-5 text-sm text-slate-500">No verified payments yet.</p>}</section>
        <section className={`${panel} overflow-hidden`}><div className="border-b border-slate-200 px-5 py-4"><h2 className="m-0 text-base font-bold text-slate-900">Payment attempts</h2><p className="mb-0 mt-1 text-sm text-slate-500">Counts and attempted amounts, grouped by status and currency.</p></div>{report.byStatus.length ? <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Status', 'Currency', 'Attempts', 'Attempt amount'].map((label) => <th key={label} className="px-5 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{report.byStatus.map((row) => <tr key={`${row.status}-${row.currency}`}><td className="px-5 py-3 font-medium text-slate-800">{row.status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())}</td><td className="px-5 py-3 text-slate-600">{row.currency}</td><td className="px-5 py-3 tabular-nums text-slate-700">{row.count.toLocaleString()}</td><td className="px-5 py-3 tabular-nums text-slate-700">{money(row.amount, row.currency)}</td></tr>)}</tbody></table></div> : <p className="p-5 text-sm text-slate-500">No payment attempts yet.</p>}</section>
        <p className="m-0 text-xs text-slate-500">These figures are ticket payments. Platform fees, refunds, and organizer payouts are not tracked here.</p>
      </>}
      <Link to="/admin/reports" className="inline-flex text-sm font-semibold text-indigo-700 hover:underline">View registration and attendance reports →</Link>
    </div>
  </DashboardShell>
}

export function AdminReportsPage() {
  const request = useAuthenticatedApi()
  const [report, setReport] = useState<ActivityReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      request<ActivityReport['registrations']>({ method: 'GET', url: '/admin/analytics/registrations' }),
      request<ActivityReport['attendance']>({ method: 'GET', url: '/admin/analytics/attendance' }),
      request<ActivityReport['sales']>({ method: 'GET', url: '/admin/analytics/sales' }),
    ]).then(([registrations, attendance, sales]) => { if (active) setReport({ registrations: registrations.data, attendance: attendance.data, sales: sales.data }) })
      .catch(() => { if (active) setReport(null) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [attempt, request])

  const months = report?.registrations.months ?? []
  const maxCreated = Math.max(1, ...months.map((month) => month.created))
  const currencies = [...new Set((report?.sales.months ?? []).flatMap((month) => month.grossSales.map((sale) => sale.currency)))]

  return <DashboardShell role="ADMIN" pageTitle="Platform reports">
    <div className="space-y-5"><div><p className="mb-1 text-sm font-semibold text-indigo-700">PLATFORM ACTIVITY</p><h1 className="m-0 text-2xl font-bold text-slate-900">Reports</h1><p className="mb-0 mt-2 text-sm text-slate-600">Follow registration activity and event attendance across the platform.</p></div>
      {loading ? <div className={`${panel} p-8 text-center text-sm text-slate-500`}>Loading reports…</div> : !report ? <div className={`${panel} p-6 text-sm text-rose-800`}>Reports could not be loaded. <button className="font-semibold underline" onClick={() => setAttempt((value) => value + 1)}>Try again</button></div> : <>
        <section className="grid gap-3 sm:grid-cols-3"><div className={`${panel} p-5`}><span className="text-sm text-slate-500">Tickets issued</span><strong className="mt-2 block text-2xl text-slate-900">{report.attendance.issued.toLocaleString()}</strong></div><div className={`${panel} p-5`}><span className="text-sm text-slate-500">Checked in</span><strong className="mt-2 block text-2xl text-slate-900">{report.attendance.checkedIn.toLocaleString()}</strong></div><div className={`${panel} p-5`}><span className="text-sm text-slate-500">Attendance rate</span><strong className="mt-2 block text-2xl text-slate-900">{Math.round(report.attendance.rate * 100)}%</strong></div></section>
        <section className={`${panel} overflow-hidden`}><div className="border-b border-slate-200 px-5 py-4"><h2 className="m-0 text-base font-bold text-slate-900">Registrations by month</h2><p className="mb-0 mt-1 text-sm text-slate-500">New registrations and confirmed registrations over the last six months.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Month', 'New registrations', 'Confirmed', 'Activity'].map((label) => <th key={label} className="px-5 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{months.map((month) => <tr key={month.month}><td className="px-5 py-3 font-medium text-slate-800">{monthLabel(month.month)}</td><td className="px-5 py-3 tabular-nums text-slate-700">{month.created.toLocaleString()}</td><td className="px-5 py-3 tabular-nums text-slate-700">{month.confirmed.toLocaleString()}</td><td className="px-5 py-3"><div className="h-2 max-w-[240px] overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(month.created ? 3 : 0, month.created / maxCreated * 100)}%` }} /></div></td></tr>)}</tbody></table></div></section>
        <section className={`${panel} overflow-hidden`}><div className="border-b border-slate-200 px-5 py-4"><h2 className="m-0 text-base font-bold text-slate-900">Sales by month</h2><p className="mb-0 mt-1 text-sm text-slate-500">Verified successful payments, kept separate by currency.</p></div>{currencies.length ? <div className="grid gap-6 p-5 md:grid-cols-2">{currencies.map((currency) => <div key={currency}><h3 className="mb-3 mt-0 text-sm font-semibold text-slate-800">{currency}</h3><div className="space-y-3">{report.sales.months.map((month) => { const value = Number(month.grossSales.find((sale) => sale.currency === currency)?.amount ?? 0); const maximum = Math.max(0, ...report.sales.months.map((item) => Number(item.grossSales.find((sale) => sale.currency === currency)?.amount ?? 0))); return <div key={month.month} className="grid grid-cols-[90px_1fr_auto] items-center gap-3"><span className="text-xs text-slate-500">{monthLabel(month.month)}</span><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${maximum ? Math.max(value ? 3 : 0, value / maximum * 100) : 0}%` }} /></div><span className="text-right text-xs tabular-nums text-slate-700">{money(String(value), currency)}</span></div> })}</div></div>)}</div> : <p className="p-5 text-sm text-slate-500">No verified sales during this period.</p>}</section>
      </>}
      <Link to="/admin/payments" className="inline-flex text-sm font-semibold text-indigo-700 hover:underline">Review payment details →</Link>
    </div>
  </DashboardShell>
}
