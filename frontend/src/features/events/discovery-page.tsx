import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../../lib/api'
import { EventCard, type PublicEventCard } from './event-card'

interface Category { id: string; name: string; slug: string }
interface EventPage { items: PublicEventCard[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }
type Filters = { search: string; categoryId: string; from: string; to: string; sort: string }
const defaultFilters: Filters = { search: '', categoryId: '', from: '', to: '', sort: 'startAt' }

export function RecentEvents() {
  const [events, setEvents] = useState<PublicEventCard[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    api.get<EventPage>('/events?sort=newest&direction=desc&page=1&pageSize=4')
      .then(({ data }) => { if (active) { setEvents(data.items); setState('ready') } })
      .catch(() => { if (active) setState('error') })
    return () => { active = false }
  }, [retry])
  return <section className="home-section" aria-labelledby="recent-events-title">
    <div className="section-heading"><div><span className="eyebrow">Fresh on the calendar</span><h2 id="recent-events-title">Recently published</h2></div><Link className="section-link" to="/discover">View all events <span aria-hidden="true">↗</span></Link></div>
    {state === 'loading' ? <div className="empty-state" aria-live="polite">Finding the latest events…</div> : state === 'error' ? <div className="empty-state" role="alert"><span>Events couldn’t load right now.</span><button className="text-button" onClick={() => { setState('loading'); setRetry(x => x + 1) }}>Try again</button></div> : events.length ? <div className="event-grid">{events.map(event => <EventCard event={event} key={event.id} />)}</div> : <div className="empty-state">New events are on their way. Check back soon.</div>}
  </section>
}

export function ExploreCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [failed, setFailed] = useState(false)
  useEffect(() => { let active = true; api.get<Category[]>('/categories').then(({ data }) => { if (active) setCategories(data) }).catch(() => { if (active) setFailed(true) }); return () => { active = false } }, [])
  return <section className="home-section categories-section" aria-labelledby="categories-title"><div className="section-heading"><div><span className="eyebrow">Follow what moves you</span><h2 id="categories-title">Explore by interest</h2></div><Link className="section-link" to="/discover">Browse all <span aria-hidden="true">↗</span></Link></div>
    {failed ? <p className="inline-notice" role="status">Categories are unavailable right now. You can still browse all events.</p> : categories.length ? <div className="category-links">{categories.map(category => <Link key={category.id} to={`/discover?categoryId=${encodeURIComponent(category.id)}`}><span>{category.name}</span><span aria-hidden="true">↗</span></Link>)}</div> : <p className="inline-notice" aria-live="polite">Loading event categories…</p>}
  </section>
}

export function DiscoveryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryKey = searchParams.toString()
  const applied = readFilters(new URLSearchParams(queryKey))
  const page = Math.max(1, Number(new URLSearchParams(queryKey).get('page') || 1))
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesError, setCategoriesError] = useState(false)
  const [draft, setDraft] = useState({ queryKey, filters: applied })
  const [results, setResults] = useState<EventPage | null>(null)
  const [loadedKey, setLoadedKey] = useState('')
  const [failedKey, setFailedKey] = useState('')
  const [retry, setRetry] = useState(0)
  const requestKey = `${queryKey}:${retry}`
  const loading = loadedKey !== requestKey
  const error = failedKey === requestKey
  const filters = draft.queryKey === queryKey ? draft.filters : applied
  useEffect(() => {
    let active = true
    api.get<Category[]>('/categories').then(({ data }) => { if (active) setCategories(data) }).catch(() => { if (active) setCategoriesError(true) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    let active = true
    const params = new URLSearchParams(queryKey)
    params.set('pageSize', '9')
    if (!params.has('sort')) params.set('sort', 'startAt')
    api.get<EventPage>(`/events?${params.toString()}`).then(({ data }) => { if (active) setResults(data) })
      .catch(() => { if (active) setFailedKey(requestKey) }).finally(() => { if (active) setLoadedKey(requestKey) })
    return () => { active = false }
  }, [queryKey, requestKey])

  function updateFilters(next: Filters) { setDraft({ queryKey, filters: next }) }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = new URLSearchParams()
    if (filters.search.trim()) next.set('search', filters.search.trim())
    if (filters.categoryId) next.set('categoryId', filters.categoryId)
    if (filters.from) next.set('from', filters.from)
    if (filters.to) next.set('to', `${filters.to}T23:59:59.999Z`)
    if (filters.sort !== 'startAt') next.set('sort', filters.sort)
    setSearchParams(next)
  }
  function changePage(nextPage: number) { const next = new URLSearchParams(searchParams); next.set('page', String(nextPage)); setSearchParams(next) }
  function clearFilters() { updateFilters(defaultFilters); setSearchParams({}) }

  return <main className="discover-page" aria-labelledby="discover-title">
    <header className="discover-intro"><span className="eyebrow">Make a plan</span><h1 id="discover-title">Find something<br /><em>worth looking forward to.</em></h1><p>From new ideas and live music to good company in your city.</p></header>
    <form className="event-filters" onSubmit={submit} aria-label="Filter events">
      <label className="filter-search">Search events<input maxLength={120} placeholder="Try a topic, venue, or city" value={filters.search} onChange={event => updateFilters({ ...filters, search: event.target.value })} /></label>
      <label>Category<select value={filters.categoryId} onChange={event => updateFilters({ ...filters, categoryId: event.target.value })}><option value="">All categories</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label>From<input type="date" value={filters.from} onChange={event => updateFilters({ ...filters, from: event.target.value })} /></label>
      <label>To<input type="date" min={filters.from || undefined} value={filters.to} onChange={event => updateFilters({ ...filters, to: event.target.value })} /></label>
      <label>Sort by<select value={filters.sort} onChange={event => updateFilters({ ...filters, sort: event.target.value })}><option value="startAt">Upcoming</option><option value="newest">Recently published</option><option value="title">Event name</option></select></label>
      <div className="filter-actions"><button className="button button--dark" type="submit">Find events <span aria-hidden="true">↗</span></button><button className="text-button" type="button" onClick={clearFilters}>Clear</button></div>
    </form>
    {categoriesError && <p className="inline-notice" role="status">Categories are temporarily unavailable; you can still search all events.</p>}
    <div className="results-heading"><h2>Events to explore</h2><p>{loading ? 'Updating results…' : results ? `${results.pagination.total} ${results.pagination.total === 1 ? 'event' : 'events'}${filters.search ? ` for “${filters.search}”` : ''}` : ''}</p></div>
    {error ? <div className="empty-state" role="alert"><p>Events couldn’t load right now.</p><button className="text-button" onClick={() => setRetry(value => value + 1)} type="button">Try again</button></div>
      : loading ? <div className="event-grid" aria-label="Loading events">{Array.from({ length: 6 }, (_, index) => <div key={index} className="event-skeleton" aria-hidden="true" />)}</div>
        : results?.items.length ? <><div className="event-grid">{results.items.map(event => <EventCard event={event} key={event.id} />)}</div>
          {results.pagination.totalPages > 1 && <nav className="pagination" aria-label="Event results pages"><button className="text-button" disabled={page <= 1} onClick={() => changePage(page - 1)} type="button">← Previous</button><span>Page {page} of {results.pagination.totalPages}</span><button className="text-button" disabled={page >= results.pagination.totalPages} onClick={() => changePage(page + 1)} type="button">Next →</button></nav>}</>
          : <div className="empty-state"><p>No events match these filters.</p><button className="text-button" onClick={clearFilters} type="button">Clear filters</button></div>}
  </main>
}

function readFilters(params: URLSearchParams): Filters {
  const sort = params.get('sort') ?? 'startAt'
  return { search: params.get('search') ?? '', categoryId: params.get('categoryId') ?? '', from: params.get('from')?.slice(0, 10) ?? '', to: params.get('to')?.slice(0, 10) ?? '', sort: ['startAt', 'newest', 'title'].includes(sort) ? sort : 'startAt' }
}
