import { Link } from 'react-router'
import { formatEventDate } from './event-format'
import { getEventPlaceholder } from '../../lib/placeholders'
import { IconMapPin, IconCalendar } from '../../components/ui/icons'

export interface PublicEventCard {
  id: string
  slug: string
  title: string
  description: string
  venue: string
  city: string
  startAt: string
  endAt: string
  timezone: string
  coverImageUrl: string | null
  category: { id: string; name: string; slug: string }
  startingPrice: string | null
  currency: string | null
  hasAvailability: boolean
}

export function EventCard({ event }: { event: PublicEventCard }) {
  const coverImage = event.coverImageUrl || getEventPlaceholder(event.category.name)

  return (
    <article className="group flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)] transition-[all] duration-[250ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:translate-y-[-4px] hover:border-slate-300 hover:shadow-[0_16px_32px_-8px_rgba(15,23,42,0.12)]">
      <Link to={`/events/${event.slug}`} className="relative aspect-video overflow-hidden bg-slate-900" aria-label={`View ${event.title}`}>
        <img className="h-full w-full object-cover transition-transform duration-[400ms] ease-[ease] group-hover:scale-[1.05]" src={coverImage} alt={event.title} loading="lazy" />
        <span className="absolute top-3.5 left-3.5 rounded-full bg-[rgba(15,23,42,0.75)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.5px] text-white backdrop-blur-lg">{event.category.name}</span>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)]">
          <IconCalendar className="h-3.5 w-3.5" />
          <time dateTime={event.startAt}>{formatEventDate(event.startAt, event.timezone)}</time>
        </div>

        <h3 className="mb-2 text-lg leading-[1.3] font-bold text-[var(--text-main)]">
          <Link className="transition-colors duration-150 hover:text-[var(--primary)]" to={`/events/${event.slug}`}>{event.title}</Link>
        </h3>

        <div className="mb-3 flex items-center gap-1.5 text-[13px] text-[var(--text-muted)]">
          <IconMapPin className="h-3.5 w-3.5 shrink-0" />
          <span>{event.venue} · {event.city}</span>
        </div>

        <p className="mb-4 line-clamp-2 text-[13px] leading-[1.5] text-[var(--text-muted)]">{event.description}</p>

        <div className="mt-auto flex items-center justify-between border-t border-[var(--border)] pt-3.5">
          <div className="text-sm font-bold text-[var(--text-main)]">
            {event.startingPrice ? (
              <>
                <span className="text-muted text-xs block font-medium">From</span>
                {event.currency} {Number(event.startingPrice).toLocaleString()}
              </>
            ) : (
              <span className="text-muted text-[13px]">Admission TBA</span>
            )}
          </div>

          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none capitalize ${event.hasAvailability ? "border border-[#a7f3d0] bg-[#ecfdf5] text-[#059669] [--badge-dot-color:#10b981]" : "border border-[#fecaca] bg-[#fef2f2] text-[#dc2626] [--badge-dot-color:#ef4444]"}`}>
            <span className="h-[6px] w-[6px] rounded-full bg-[var(--badge-dot-color)]" />
            {event.hasAvailability ? 'Tickets Available' : 'Sold Out'}
          </span>
        </div>
      </div>
    </article>
  )
}
