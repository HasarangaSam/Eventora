import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../../lib/api'
import { EventCard, type PublicEventCard } from './event-card'

interface Category { id: string; name: string; slug: string }
interface EventPage {
  items: PublicEventCard[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}
interface SearchFilters {
  search: string
  categoryId: string
  from: string
  to: string
  sort: string
}

export function FeaturedEvents() {
  const [events, setEvents] = useState<PublicEventCard[]>([])
  useEffect(() => {
    let active = true
    void api.get<PublicEventCard[]>('/events/featured').then(({ data }) => {
      if (active) setEvents(data)
    }).catch(() => { if (active) setEvents([]) })
    return () => { active = false }
  }, [])

  if (!events.length) return null
  return <section className="featured-events" aria-labelledby="featured-title">
    <div className="section-heading"><div><span className="eyebrow">Picked for the calendar</span><h2 id="featured-title">Featured experiences</h2></div></div>
    <div className="event-grid">{events.map((event) => <EventCard event={event} key={event.id} />)}</div>
  </section>
}

export function DiscoveryPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesError, setCategoriesError] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({ search: '', categoryId: '', from: '', to: '', sort: 'startAt' })
  const [applied, setApplied] = useState(filters)
  const [page, setPage] = useState(1)
  const [results, setResults] = useState<EventPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    void api.get<Category[]>('/categories').then(({ data }) => {
      if (active) setCategories(data)
    }).catch(() => { if (active) setCategoriesError(true) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const params = new URLSearchParams({ page: String(page), pageSize: '9', sort: applied.sort })
    if (applied.search) params.set('search', applied.search)
    if (applied.categoryId) params.set('categoryId', applied.categoryId)
    if (applied.from) params.set('from', new Date(`${applied.from}T00:00:00`).toISOString())
    if (applied.to) params.set('to', new Date(`${applied.to}T23:59:59.999`).toISOString())
    void api.get<EventPage>(`/events?${params.toString()}`).then(({ data }) => {
      if (active) setResults(data)
    }).catch(() => { if (active) setError(true) }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [applied, page])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(false)
    setPage(1)
    setApplied({ ...filters })
  }

  return <section className="discover" id="discover" aria-labelledby="discover-title">
    <div className="section-heading">
      <div><span className="eyebrow">Make a plan</span><h2 id="discover-title">Find your next event.</h2></div>
      <p>{results?.pagination.total ?? 'Browse'} experiences to look forward to.</p>
    </div>
    <form className="event-filters" onSubmit={submit} aria-label="Filter events">
      <label>Search<input maxLength={120} placeholder="Music, food, workshops…" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
      <label>Category<select value={filters.categoryId} onChange={(event) => setFilters({ ...filters, categoryId: event.target.value })}>
        <option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select></label>
      <label>From<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
      <label>To<input type="date" min={filters.from || undefined} value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
      <label>Sort<select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}>
        <option value="startAt">Soonest</option><option value="newest">Recently added</option><option value="title">Name</option>
      </select></label>
      <button className="button button--dark" type="submit">Find events</button>
    </form>
    {categoriesError && <p className="inline-notice" role="status">Categories are temporarily unavailable; you can still search all events.</p>}
    {error ? <div className="empty-state" role="alert"><p>Events couldn’t load right now.</p><button className="text-button" onClick={() => { setLoading(true); setApplied({ ...applied }) }} type="button">Try again</button></div>
      : loading ? <div className="empty-state" aria-live="polite"><p>Finding events…</p></div>
        : results?.items.length ? <>
          <div className="event-grid">{results.items.map((event) => <EventCard event={event} key={event.id} />)}</div>
          <nav className="pagination" aria-label="Event results pages">
            <button className="text-button" disabled={page <= 1} onClick={() => { setLoading(true); setPage((current) => current - 1) }} type="button">← Previous</button>
            <span>Page {page} of {results.pagination.totalPages}</span>
            <button className="text-button" disabled={page >= results.pagination.totalPages} onClick={() => { setLoading(true); setPage((current) => current + 1) }} type="button">Next →</button>
          </nav>
        </> : <div className="empty-state"><span aria-hidden="true">✳</span><p>No upcoming events match these filters.</p></div>}
  </section>
}
