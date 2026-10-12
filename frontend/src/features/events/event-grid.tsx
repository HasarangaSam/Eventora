import { EventCard, type PublicEventCard } from './event-card'

export function EventGrid({ events }: { events: PublicEventCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {events.map((event) => (
        <EventCard event={event} key={event.id} />
      ))}
    </div>
  )
}
