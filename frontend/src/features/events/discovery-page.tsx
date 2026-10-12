import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../../lib/api'
import { EventCard, type PublicEventCard } from './event-card'
import { IconSearch, IconSparkles, IconArrowRight } from '../../components/ui/icons'

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
          <span className="badge badge-indigo" style={{ marginBottom: '8px' }}>
            <IconSparkles style={{ width: '12px', height: '12px' }} /> Just Announced
          </span>
          <h2 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: 800 }}>Recently Published Events</h2>
        </div>
        <Link to="/discover" className="text-button" style={{ fontSize: '14px' }}>
          Explore All Events <IconArrowRight style={{ width: '14px', height: '14px' }} />
        </Link>
      </div>

      {state === 'loading' ? (
        <div className="event-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="event-card" style={{ height: '360px', background: '#f1f5f9', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : state === 'error' ? (
        <div className="table-card" style={{ padding: '32px', textAlign: 'center' }}>
          <p className="text-muted">Could not load featured events.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRetry((r) => r + 1)}>
            Try Again
          </button>
        </div>
      ) : events.length ? (
        <div className="event-grid">
          {events.map((event) => (
            <EventCard event={event} key={event.id} />
          ))}
        </div>
      ) : (
        <div className="table-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
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
        <span className="badge badge-indigo" style={{ marginBottom: '8px' }}>
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
            className="btn btn-secondary"
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
    <main className="public-container" style={{ padding: '16px 24px 80px' }}>
      {/* Search & Hero Intro */}
      <div className="discover-hero">
        <h1>Find Your Next Experience</h1>
        <p className="text-muted" style={{ maxWidth: '560px', margin: '0 auto', fontSize: '16px' }}>
          Explore trending concerts, tech summits, workshops, and community events across Sri Lanka.
        </p>
      </div>

      {/* Filter Bar */}
      <form className="discover-filter-bar" onSubmit={submit}>
        <div className="filter-bar-grid">
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Search Query</label>
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
                className="form-input"
                style={{ paddingLeft: '36px' }}
                placeholder="Topic, venue, or artist…"
                value={filters.search}
                onChange={(e) => updateFilters({ ...filters, search: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Category</label>
            <select
              className="form-select"
              value={filters.categoryId}
              onChange={(e) => updateFilters({ ...filters, categoryId: e.target.value })}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">From Date</label>
            <input
              type="date"
              className="form-input"
              value={filters.from}
              onChange={(e) => updateFilters({ ...filters, from: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Sort</label>
            <select
              className="form-select"
              value={filters.sort}
              onChange={(e) => updateFilters({ ...filters, sort: e.target.value })}
            >
              <option value="startAt">Earliest Date</option>
              <option value="newest">Recently Added</option>
              <option value="title">Alphabetical</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn btn-primary" style={{ height: '42px' }}>
              Filter
            </button>
            <button type="button" className="btn btn-secondary" style={{ height: '42px' }} onClick={clearFilters}>
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
        <div className="event-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="event-card"
              style={{ height: '360px', background: '#f1f5f9', animation: 'pulse 1.5s infinite' }}
            />
          ))}
        </div>
      ) : error ? (
        <div className="table-card" style={{ padding: '40px', textAlign: 'center' }}>
          <p className="text-muted">Could not load event results.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRetry((r) => r + 1)}>
            Retry Search
          </button>
        </div>
      ) : results?.items.length ? (
        <>
          <div className="event-grid">
            {results.items.map((event) => (
              <EventCard event={event} key={event.id} />
            ))}
          </div>

          {/* Pagination */}
          {results.pagination.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', alignItems: 'center', marginTop: '48px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
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
                className="btn btn-secondary btn-sm"
                disabled={page >= results.pagination.totalPages}
                onClick={() => changePage(page + 1)}
              >
                Next Page →
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="table-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 600 }}>No events match your criteria</p>
          <span style={{ fontSize: '14px' }}>Try broadening your search term or clearing date filters.</span>
          <div style={{ marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={clearFilters}>
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
