import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class OrganizerNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizerId: string) {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const [bookings, paymentExceptions, cancellations, capacityEvents] = await Promise.all([
      this.prisma.registration.findMany({
        where: { event: { organizerId }, status: 'CONFIRMED', confirmedAt: { gte: since } },
        orderBy: { confirmedAt: 'desc' }, take: 20,
        select: {
          id: true, quantity: true, totalAmount: true, currency: true, confirmedAt: true,
          attendee: { select: { firstName: true, lastName: true } },
          ticketType: { select: { name: true } },
          event: { select: { id: true, title: true } },
        },
      }),
      this.prisma.paymentException.findMany({
        where: { createdAt: { gte: since }, registration: { event: { organizerId } } },
        orderBy: { createdAt: 'desc' }, take: 10,
        select: {
          id: true, reasonCode: true, description: true, createdAt: true,
          registration: { select: { event: { select: { id: true, title: true } } } },
        },
      }),
      this.prisma.event.findMany({
        where: { organizerId, status: 'CANCELLED', cancelledAt: { gte: since }, cancelledById: { not: null } },
        orderBy: { cancelledAt: 'desc' }, take: 10,
        select: { id: true, title: true, cancelledAt: true, cancellationReason: true, cancelledBy: { select: { role: true } } },
      }),
      this.prisma.event.findMany({
        where: { organizerId, status: 'PUBLISHED', capacity: { not: null }, startAt: { gt: now } },
        orderBy: { startAt: 'asc' }, take: 100,
        select: { id: true, title: true, capacity: true, ticketsSold: true, updatedAt: true, startAt: true },
      }),
    ]);

    const notifications = [
      ...bookings.map((booking) => {
        const name = [booking.attendee.firstName, booking.attendee.lastName].filter(Boolean).join(' ') || 'A participant';
        return {
          id: `booking:${booking.id}`, type: 'BOOKING_CONFIRMED', title: 'New booking confirmed',
          message: `${name} booked ${booking.quantity} ${booking.ticketType.name} ${booking.quantity === 1 ? 'ticket' : 'tickets'} for ${booking.event.title}.`,
          createdAt: booking.confirmedAt!, href: `/organizer/participants?event=${encodeURIComponent(booking.event.id)}`,
          eventId: booking.event.id, eventTitle: booking.event.title, actionRequired: false,
          detail: `${booking.currency} ${booking.totalAmount.toFixed(2)}`,
        };
      }),
      ...paymentExceptions.map((exception) => ({
        id: `payment-exception:${exception.id}`, type: 'PAYMENT_REVIEW', title: 'Payment needs review',
        message: `${exception.registration.event.title}: ${exception.reasonCode.replaceAll('_', ' ').toLowerCase()}. ${exception.description.slice(0, 180)}`,
        createdAt: exception.createdAt, href: `/organizer/sales/${exception.registration.event.id}`,
        eventId: exception.registration.event.id, eventTitle: exception.registration.event.title, actionRequired: true,
      })),
      ...cancellations.filter((event) => event.cancelledBy?.role === 'ADMIN').map((event) => ({
        id: `event-cancelled:${event.id}`, type: 'EVENT_CANCELLED', title: 'Event cancelled by platform admin',
        message: `${event.title}${event.cancellationReason ? `: ${event.cancellationReason}` : '.'}`,
        createdAt: event.cancelledAt!, href: '/organizer/events', eventId: event.id, eventTitle: event.title, actionRequired: true,
      })),
      ...capacityEvents.filter((event) => event.capacity && event.ticketsSold >= Math.ceil(event.capacity * 0.9)).map((event) => ({
        id: `capacity:${event.id}`, type: 'CAPACITY_NEAR', title: 'Event is nearly full',
        message: `${event.title} has sold ${event.ticketsSold} of ${event.capacity} available tickets.`,
        createdAt: event.updatedAt, href: `/organizer/sales/${event.id}`, eventId: event.id, eventTitle: event.title,
        actionRequired: true, detail: `${Math.round((event.ticketsSold / event.capacity!) * 100)}% full`,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 30);

    const readRecords = await this.prisma.organizerNotificationRead.findMany({
      where: { organizerUserId: organizerId, notificationId: { in: notifications.map((item) => item.id) } },
      select: { notificationId: true },
    });
    const readIds = new Set(readRecords.map((record) => record.notificationId));
    const items = notifications.map((item) => ({ ...item, isRead: readIds.has(item.id) }));
    return {
      unreadCount: items.filter((item) => !item.isRead).length,
      notificationCount: items.length,
      periodDays: 14,
      notifications: items,
    };
  }

  async markRead(organizerId: string, notificationIds: string[]) {
    if (notificationIds.some((id) => !/^(booking|payment-exception|event-cancelled|capacity):[^:]+$/.test(id))) {
      throw new BadRequestException('A notification ID is invalid');
    }
    await this.prisma.organizerNotificationRead.createMany({
      data: notificationIds.map((notificationId) => ({ organizerUserId: organizerId, notificationId })),
      skipDuplicates: true,
    });
    return { success: true };
  }
}
