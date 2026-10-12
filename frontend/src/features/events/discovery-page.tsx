import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../../lib/api'
import type { PublicEventCard } from './event-card'
import { EventGrid } from './event-grid'
import { IconSearch, IconSparkles, IconArrowRight } from '../../components/ui/icons'
import { PageIntro } from '../../components/layout/page-intro'

interface Category {
  id: string
  name: string
  slug: string
}

interface EventPage {
  items: PublicEventCard[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

type Filters = { search: string; categoryId: string; from: string; to: string; sort: string }
const defaultFilters: Filters = { search: '', categoryId: '', from: '', to: '', sort: 'startAt' }

export function RecentEvents() {
  const [events, setEvents] = useState<PublicEventCard[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    async function loadRecentEvents() {
      try {
        const { data } = await api.get<EventPage>('/events?sort=newest&direction=desc&page=1&pageSize=4')
        if (active) {
          setEvents(data.items)
          setState('ready')
        }
      } catch {
        if (active) setState('error')
      }
    }
    void loadRecentEvents()
    return () => {
      active = false
    }
  }, [retry])

  return (
    <section style={{ padding: '60px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none capitalize border border-[#c7d2fe] bg-[#eef2ff] text-[#4f46e5] [--badge-dot-color:#6366f1]" style={{ marginBottom: '8px' }}>
            <IconSparkles style={{ width: '12px', height: '12px' }} /> Just Announced
          </span>
          <h2 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: 800 }}>Recently Published Events</h2>
        </div>
        <Link to="/discover" className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border-0 bg-transparent px-2 py-1 text-[13px] font-semibold text-[var(--text-button-color,var(--primary))] cursor-pointer transition-[all] duration-150 hover:bg-[var(--text-button-bg,var(--primary-light))] hover:text-[var(--text-button-hover,var(--primary-hover))]" style={{ fontSize: '14px' }}>
          Explore All Events <IconArrowRight style={{ width: '14px', height: '14px' }} />
        </Link>
      </div>

      {state === 'loading' ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-7">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[360px] animate-pulse overflow-hidden rounded-2xl border border-[var(--border)] bg-slate-100 shadow-[var(--shadow-sm)] [animation-duration:1.5s]" />
          ))}
        </div>
      ) : state === 'error' ? (
        <div className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ padding: '32px', textAlign: 'center' }}>
          <p className="text-muted">Could not load featured events.</p>
          <button type="button" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)] [--button-px:12px] [--button-py:6px] [--button-font-size:13px] [--button-radius:var(--radius-sm)] text-[13px]" onClick={() => setRetry((r) => r + 1)}>
            Try Again
          </button>
        </div>
      ) : events.length ? (
        <EventGrid events={events} />
      ) : (
        <div className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No published events available right now. Check back soon!
        </div>
      )}
    </section>
  )
}

export function ExploreCategories() {
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    let active = true
    async function loadCategories() {
      try {
        const { data } = await api.get<Category[]>('/categories')
        if (active) setCategories(data)
      } catch {
        // Category filtering remains optional while the request is unavailable.
      }
    }
    void loadCategories()
    return () => {
      active = false
    }
  }, [])

  if (!categories.length) return null

  return (
    <section style={{ padding: '60px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none capitalize border border-[#c7d2fe] bg-[#eef2ff] text-[#4f46e5] [--badge-dot-color:#6366f1]" style={{ marginBottom: '8px' }}>
          Browse By Passion
        </span>
        <h2 style={{ margin: '4px 0 8px', fontSize: '28px', fontWeight: 800 }}>Explore by Category</h2>
        <p className="text-muted" style={{ margin: 0, fontSize: '15px' }}>
          Find experiences tailored to your interests, from tech conventions to live musical concerts.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
        {categories.map((c) => (
          <Link
            key={c.id}
            to={`/discover?categoryId=${encodeURIComponent(c.id)}`}
            className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)]"
            style={{ borderRadius: 'var(--radius-full)', padding: '10px 20px', fontSize: '14px' }}
          >
            {c.name}
          </Link>
        ))}
      </div>
    </section>
  )
}

export function DiscoveryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryKey = searchParams.toString()
  const applied = readFilters(new URLSearchParams(queryKey))
  const page = Math.max(1, Number(new URLSearchParams(queryKey).get('page') || 1))

  const [categories, setCategories] = useState<Category[]>([])
  const [draft, setDraft] = useState({ queryKey, filters: applied })
  const [results, setResults] = useState<EventPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)

  const filters = draft.queryKey === queryKey ? draft.filters : applied

  useEffect(() => {
    let active = true
    async function loadCategories() {
      try {
        const { data } = await api.get<Category[]>('/categories')
        if (active) setCategories(data)
      } catch {
        // Category filters are unavailable; event search can still be used.
      }
    }
    void loadCategories()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    const params = new URLSearchParams(queryKey)
    params.set('pageSize', '9')
    if (!params.has('sort')) params.set('sort', 'startAt')

    async function loadEvents() {
      try {
        const { data } = await api.get<EventPage>(`/events?${params.toString()}`)
        if (active) setResults(data)
      } catch {
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadEvents()

    return () => {
      active = false
    }
  }, [queryKey, retry])

  function updateFilters(next: Filters) {
    setDraft({ queryKey, filters: next })
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const next = new URLSearchParams()
    if (filters.search.trim()) next.set('search', filters.search.trim())
    if (filters.categoryId) next.set('categoryId', filters.categoryId)
    if (filters.from) next.set('from', filters.from)
    if (filters.to) next.set('to', `${filters.to}T23:59:59.999Z`)
    if (filters.sort !== 'startAt') next.set('sort', filters.sort)
    setSearchParams(next)
  }

  function changePage(nextPage: number) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(nextPage))
    setSearchParams(next)
  }

  function clearFilters() {
    updateFilters(defaultFilters)
    setSearchParams({})
  }

  return (
    <main className="mx-auto w-full max-w-[1280px] px-6 pt-4 pb-20">
      {/* Search & Hero Intro */}
      <PageIntro
        centered
        eyebrow="Discover Eventora"
        title="Find your next experience"
        description="Explore trending concerts, tech summits, workshops, and community events across Sri Lanka."
      />

      {/* Filter Bar */}
      <form className="mb-9 rounded-[var(--radius-xl)] border border-[var(--border)] bg-white px-5 py-4 shadow-[var(--shadow-md)]" onSubmit={submit}>
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 xl:grid-cols-[2fr_1.2fr_1fr_1fr_auto]">
          <div className="mb-[18px] flex flex-col gap-1.5" style={{ margin: 0 }}>
            <label className="text-[13px] font-semibold text-[var(--text-main)]">Search Query</label>
            <div style={{ position: 'relative' }}>
              <IconSearch
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '11px',
                  width: '16px',
                  height: '16px',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                style={{ paddingLeft: '36px' }}
                placeholder="Topic, venue, or artist…"
                value={filters.search}
                onChange={(e) => updateFilters({ ...filters, search: e.target.value })}
              />
            </div>
          </div>

          <div className="mb-[18px] flex flex-col gap-1.5" style={{ margin: 0 }}>
            <label className="text-[13px] font-semibold text-[var(--text-main)]">Category</label>
            <select
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
              value={filters.categoryId}
              onChange={(e) => updateFilters({ ...filters, categoryId: e.target.value })}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="mb-[18px] flex flex-col gap-1.5" style={{ margin: 0 }}>
            <label className="text-[13px] font-semibold text-[var(--text-main)]">From Date</label>
            <input
              type="date"
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
              value={filters.from}
              onChange={(e) => updateFilters({ ...filters, from: e.target.value })}
            />
          </div>

          <div className="mb-[18px] flex flex-col gap-1.5" style={{ margin: 0 }}>
            <label className="text-[13px] font-semibold text-[var(--text-main)]">Sort</label>
            <select
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-main)] transition-all duration-150 focus:border-[var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
              value={filters.sort}
              onChange={(e) => updateFilters({ ...filters, sort: e.target.value })}
            >
              <option value="startAt">Earliest Date</option>
              <option value="newest">Recently Added</option>
              <option value="title">Alphabetical</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] enabled:hover:bg-[linear-gradient(135deg,#4f46e5_0%,#4338ca_100%)] enabled:hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] enabled:hover:translate-y-[-1px]" style={{ height: '42px' }}>
              Filter
            </button>
            <button type="button" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)]" style={{ height: '42px' }} onClick={clearFilters}>
              Clear
            </button>
          </div>
        </div>
      </form>

      {/* Results Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>
          {results ? `${results.pagination.total} Events Found` : 'Events'}
        </h2>
      </div>

      {/* Grid of Events */}
      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-7">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[360px] animate-pulse overflow-hidden rounded-2xl border border-[var(--border)] bg-slate-100 shadow-[var(--shadow-sm)] [animation-duration:1.5s]"
            />
          ))}
        </div>
      ) : error ? (
        <div className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ padding: '40px', textAlign: 'center' }}>
          <p className="text-muted">Could not load event results.</p>
          <button type="button" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)] [--button-px:12px] [--button-py:6px] [--button-font-size:13px] [--button-radius:var(--radius-sm)] text-[13px]" onClick={() => setRetry((r) => r + 1)}>
            Retry Search
          </button>
        </div>
      ) : results?.items.length ? (
        <>
          <EventGrid events={results.items} />

          {/* Pagination */}
          {results.pagination.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', alignItems: 'center', marginTop: '48px' }}>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)] [--button-px:12px] [--button-py:6px] [--button-font-size:13px] [--button-radius:var(--radius-sm)] text-[13px]"
                disabled={page <= 1}
                onClick={() => changePage(page - 1)}
              >
                ← Previous Page
              </button>
              <span className="text-muted" style={{ fontSize: '14px' }}>
                Page {page} of {results.pagination.totalPages}
              </span>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)] [--button-px:12px] [--button-py:6px] [--button-font-size:13px] [--button-radius:var(--radius-sm)] text-[13px]"
                disabled={page >= results.pagination.totalPages}
                onClick={() => changePage(page + 1)}
              >
                Next Page →
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 600 }}>No events match your criteria</p>
          <span style={{ fontSize: '14px' }}>Try broadening your search term or clearing date filters.</span>
          <div style={{ marginTop: '20px' }}>
            <button type="button" className="inline-flex items-center justify-center gap-2 border border-transparent px-[var(--button-px,18px)] py-[var(--button-py,10px)] text-sm font-semibold leading-[1.25] rounded-[var(--button-radius,var(--radius-md))] cursor-pointer whitespace-nowrap transition-[all] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-[0.55] border-[var(--border)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)] enabled:hover:border-slate-300 enabled:hover:bg-[var(--surface-hover)]" onClick={clearFilters}>
              Reset All Filters
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

function readFilters(params: URLSearchParams): Filters {
  const sort = params.get('sort') ?? 'startAt'
  return {
    search: params.get('search') ?? '',
    categoryId: params.get('categoryId') ?? '',
    from: params.get('from')?.slice(0, 10) ?? '',
    to: params.get('to')?.slice(0, 10) ?? '',
    sort: ['startAt', 'newest', 'title'].includes(sort) ? sort : 'startAt',
  }
}
