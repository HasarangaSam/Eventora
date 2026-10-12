import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async organizerSales(organizerId: string) {
    return this.salesTrend({ registration: { event: { organizerId } } });
  }

  async adminSales() { return this.salesTrend({}); }

  async organizerRegistrations(organizerId: string) {
    return this.registrationTrend({ event: { organizerId } });
  }

  async adminRegistrations() { return this.registrationTrend({}); }

  async organizerAttendance(organizerId: string) {
    const [issued, checkedIn, events, issuedByEvent, checkInsByEvent] = await Promise.all([
      this.prisma.ticket.count({ where: { event: { organizerId }, status: { in: ['ISSUED', 'CHECKED_IN'] } } }),
      this.prisma.checkIn.count({ where: { event: { organizerId } } }),
      this.prisma.event.findMany({ where: { organizerId }, orderBy: { startAt: 'desc' }, take: 20, select: { id: true, title: true, startAt: true } }),
      this.prisma.ticket.groupBy({ by: ['eventId'], where: { event: { organizerId }, status: { in: ['ISSUED', 'CHECKED_IN'] } }, _count: { _all: true } }),
      this.prisma.checkIn.groupBy({ by: ['eventId'], where: { event: { organizerId } }, _count: { _all: true } }),
    ]);
    const issuedCounts = new Map(issuedByEvent.map(item => [item.eventId, item._count._all]));
    const checkInCounts = new Map(checkInsByEvent.map(item => [item.eventId, item._count._all]));
    return { issued, checkedIn, rate: issued ? checkedIn / issued : 0, events: events.map(event => {
      const eventIssued = issuedCounts.get(event.id) ?? 0;
      const eventCheckedIn = checkInCounts.get(event.id) ?? 0;
      return { ...event, issued: eventIssued, checkedIn: eventCheckedIn, rate: eventIssued ? eventCheckedIn / eventIssued : 0 };
    }) };
  }

  async adminAttendance() {
    const [issued, checkedIn] = await Promise.all([
      this.prisma.ticket.count({ where: { status: { in: ['ISSUED', 'CHECKED_IN'] } } }), this.prisma.checkIn.count(),
    ]);
    return { issued, checkedIn, rate: issued ? checkedIn / issued : 0 };
  }

  async adminPayments() {
    const [byStatus, verifiedGross] = await Promise.all([
      this.prisma.paymentAttempt.groupBy({ by: ['status', 'currency'], _count: { _all: true }, _sum: { amount: true } }),
      this.prisma.paymentAttempt.groupBy({ by: ['currency'], where: { status: 'SUCCEEDED', verifiedAt: { not: null } }, _count: { _all: true }, _sum: { amount: true } }),
    ]);
    return { byStatus: byStatus.map(item => ({ status: item.status, currency: item.currency, count: item._count._all, amount: item._sum.amount?.toString() ?? '0' })), verifiedGross: verifiedGross.map(item => ({ currency: item.currency, count: item._count._all, amount: item._sum.amount?.toString() ?? '0' })) };
  }

  private async salesTrend(registration: Prisma.PaymentAttemptWhereInput) {
    const months = monthWindows();
    const monthly = await Promise.all(months.map(async ({ key, start, end }) => {
      const groups = await this.prisma.paymentAttempt.groupBy({ by: ['currency'], where: { ...registration, status: 'SUCCEEDED', verifiedAt: { not: null }, paidAt: { gte: start, lt: end } }, _sum: { amount: true }, _count: { _all: true } });
      return { month: key, grossSales: groups.map(group => ({ currency: group.currency, amount: group._sum.amount?.toString() ?? '0', payments: group._count._all })) };
    }));
    return { months: monthly };
  }

  private async registrationTrend(where: { event?: { organizerId: string } }) {
    const months = monthWindows();
    return { months: await Promise.all(months.map(async ({ key, start, end }) => {
      const [created, confirmed] = await Promise.all([
        this.prisma.registration.count({ where: { ...where, createdAt: { gte: start, lt: end } } }),
        this.prisma.registration.count({ where: { ...where, status: 'CONFIRMED', confirmedAt: { gte: start, lt: end } } }),
      ]);
      return { month: key, created, confirmed };
    })) };
  }

  async attendee(userId: string) {
    const now = new Date();
    const registrationSelect = { id: true, quantity: true, totalAmount: true, currency: true, status: true, createdAt: true, confirmedAt: true,
      event: { select: { id: true, title: true, startAt: true, endAt: true, city: true, coverImageUrl: true, status: true } },
      payments: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { status: true, currency: true, amount: true } },
    };
    const [registrations, upcomingEvents, pastEvents, activeTickets, recentRegistrations] = await Promise.all([
      this.prisma.registration.findMany({
        where: { userId }, orderBy: { createdAt: 'desc' }, take: 8, select: registrationSelect,
      }),
      this.prisma.registration.findMany({ where: { userId, event: { startAt: { gte: now } } }, orderBy: { event: { startAt: 'asc' } }, take: 5, select: registrationSelect }),
      this.prisma.registration.findMany({ where: { userId, event: { startAt: { lt: now } } }, orderBy: { event: { startAt: 'desc' } }, take: 5, select: registrationSelect }),
      this.prisma.ticket.count({ where: { registration: { userId }, status: { in: ['ISSUED', 'CHECKED_IN'] }, event: { startAt: { gte: now } } } }),
      this.prisma.registration.count({ where: { userId } }),
    ]);
    return { activeTickets, registrationCount: recentRegistrations, registrations, upcomingEvents, pastEvents };
  }

  async organizer(organizerId: string) {
    const eventWhere = { organizerId };
    const registrationWhere = { event: { organizerId } };
    const paymentWhere = { status: 'SUCCEEDED' as const, verifiedAt: { not: null }, registration: registrationWhere };
    const [eventsByStatus, eventCount, confirmedRegistrations, ticketsSold, grossByCurrency,
      paymentsByStatus, ticketCount, checkedInCount, applicationsPending] = await Promise.all([
      this.prisma.event.groupBy({ by: ['status'], where: eventWhere, _count: { _all: true } }),
      this.prisma.event.count({ where: eventWhere }),
      this.prisma.registration.count({ where: { ...registrationWhere, status: 'CONFIRMED' } }),
      this.prisma.ticket.count({ where: { event: eventWhere, status: { in: ['ISSUED', 'CHECKED_IN'] } } }),
      this.prisma.paymentAttempt.groupBy({ by: ['currency'], where: paymentWhere, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.paymentAttempt.groupBy({ by: ['status'], where: { registration: registrationWhere }, _count: { _all: true } }),
      this.prisma.ticket.count({ where: { event: eventWhere, status: { in: ['ISSUED', 'CHECKED_IN'] } } }),
      this.prisma.checkIn.count({ where: { event: eventWhere } }),
      this.prisma.organizerApplication.count({ where: { applicantId: organizerId, status: 'PENDING' } }),
    ]);
    const events = await this.prisma.event.findMany({ where: eventWhere, orderBy: { updatedAt: 'desc' }, take: 8,
      select: { id: true, title: true, status: true, startAt: true, city: true, ticketsSold: true,
        _count: { select: { registrations: true, checkIns: true } } } });
    return { eventCount, eventsByStatus: Object.fromEntries(eventsByStatus.map(x => [x.status, x._count._all])),
      confirmedRegistrations, ticketsSold, grossSales: grossByCurrency.map(x => ({ currency: x.currency, amount: x._sum.amount?.toString() ?? '0', payments: x._count._all })),
      paymentsByStatus: Object.fromEntries(paymentsByStatus.map(x => [x.status, x._count._all])),
      attendance: { checkedIn: checkedInCount, issued: ticketCount, rate: ticketCount ? checkedInCount / ticketCount : 0 }, pendingApplications: applicationsPending, events };
  }

  async organizerEvent(organizerId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, organizerId }, select: { id: true, title: true, status: true, startAt: true, ticketsSold: true } });
    if (!event) throw new NotFoundException('Event not found');
    const [registrations, payments, issued, checkedIn] = await Promise.all([
      this.prisma.registration.count({ where: { eventId, status: 'CONFIRMED' } }),
      this.prisma.paymentAttempt.groupBy({ by: ['currency'], where: { status: 'SUCCEEDED', verifiedAt: { not: null }, registration: { eventId } }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.ticket.count({ where: { eventId, status: { in: ['ISSUED', 'CHECKED_IN'] } } }),
      this.prisma.checkIn.count({ where: { eventId } }),
    ]);
    return { event, confirmedRegistrations: registrations, grossSales: payments.map(x => ({ currency: x.currency, amount: x._sum.amount?.toString() ?? '0', payments: x._count._all })), attendance: { issued, checkedIn, rate: issued ? checkedIn / issued : 0 } };
  }

  async admin() {
    const [usersByRole, activeUsers, pendingApplications, eventsByStatus, registrationCount,
      confirmedRegistrations, paymentsByStatus, grossSales, issued, checkedIn] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.organizerApplication.count({ where: { status: 'PENDING' } }),
      this.prisma.event.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.registration.count(),
      this.prisma.registration.count({ where: { status: 'CONFIRMED' } }),
      this.prisma.paymentAttempt.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.paymentAttempt.groupBy({ by: ['currency'], where: { status: 'SUCCEEDED', verifiedAt: { not: null } }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.ticket.count({ where: { status: { in: ['ISSUED', 'CHECKED_IN'] } } }),
      this.prisma.checkIn.count(),
    ]);
    return { totalUsers: usersByRole.reduce((sum, item) => sum + item._count._all, 0), activeUsers,
      usersByRole: Object.fromEntries(usersByRole.map(x => [x.role, x._count._all])), pendingApplications,
      eventsByStatus: Object.fromEntries(eventsByStatus.map(x => [x.status, x._count._all])), registrationCount,
      confirmedRegistrations, paymentsByStatus: Object.fromEntries(paymentsByStatus.map(x => [x.status, x._count._all])),
      grossSales: grossSales.map(x => ({ currency: x.currency, amount: x._sum.amount?.toString() ?? '0', payments: x._count._all })),
      attendance: { checkedIn, issued, rate: issued ? checkedIn / issued : 0 } };
  }
}

function monthWindows() {
  const now = new Date();
  const current = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return Array.from({ length: 6 }, (_, index) => {
    const start = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 5 + index, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    return { key: start.toISOString().slice(0, 7), start, end };
  });
}
