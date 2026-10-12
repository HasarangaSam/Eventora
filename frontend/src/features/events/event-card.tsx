import { Link } from 'react-router'
import heroImage from '../../assets/hero.png'
import { formatEventDate } from './event-format'

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
  return <article className="event-card">
    <Link className="event-card__image" to={`/events/${event.slug}`} aria-label={`View ${event.title}`}>
      <img src={event.coverImageUrl || heroImage} alt="" loading="lazy" />
      <span>{event.category.name}</span>
    </Link>
    <div className="event-card__body">
      <time dateTime={event.startAt}>{formatEventDate(event.startAt, event.timezone)}</time>
      <h3><Link to={`/events/${event.slug}`}>{event.title}</Link></h3>
      <p className="event-card__location">{event.venue} · {event.city}</p>
      <p className="event-card__description">{event.description}</p>
      <div className="event-card__footer">
        <span>{event.startingPrice ? `From ${event.currency} ${event.startingPrice}` : 'Tickets to be announced'}</span>
        <span className={event.hasAvailability ? 'availability availability--yes' : 'availability'}>
          {event.hasAvailability ? 'Available' : 'Sold out'}
        </span>
      </div>
    </div>
  </article>
}

