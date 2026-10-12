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
    <article className="event-card">
      <Link to={`/events/${event.slug}`} className="event-card__image" aria-label={`View ${event.title}`}>
        <img src={coverImage} alt={event.title} loading="lazy" />
        <span className="event-card__category">{event.category.name}</span>
      </Link>

      <div className="event-card__body">
        <div className="event-card__date">
          <IconCalendar style={{ width: '14px', height: '14px' }} />
          <time dateTime={event.startAt}>{formatEventDate(event.startAt, event.timezone)}</time>
        </div>

        <h3 className="event-card__title">
          <Link to={`/events/${event.slug}`}>{event.title}</Link>
        </h3>

        <div className="event-card__location">
          <IconMapPin style={{ width: '14px', height: '14px', flexShrink: 0 }} />
          <span>{event.venue} · {event.city}</span>
        </div>

        <p className="event-card__description">{event.description}</p>

        <div className="event-card__footer">
          <div className="event-card__price">
            {event.startingPrice ? (
              <>
                <span className="text-muted text-xs" style={{ display: 'block', fontWeight: 500 }}>From</span>
                {event.currency} {Number(event.startingPrice).toLocaleString()}
              </>
            ) : (
              <span className="text-muted" style={{ fontSize: '13px' }}>Admission TBA</span>
            )}
          </div>

          <span className={`badge ${event.hasAvailability ? 'badge-emerald' : 'badge-rose'}`}>
            <span className="badge-dot" />
            {event.hasAvailability ? 'Tickets Available' : 'Sold Out'}
          </span>
        </div>
      </div>
    </article>
  )
}
