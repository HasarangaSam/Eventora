import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const tables = [
  'AdminNotificationRead',
  'OrganizerNotificationRead',
  'CheckIn',
  'Ticket',
  'PaymentAttempt',
  'PaymentException',
  'InventoryReservation',
  'Registration',
  'TicketType',
  'EventSession',
  'AdminAuditLog',
  'OrganizerApplicationCategory',
  'OrganizerApplication',
  'Event',
  'Category',
  'User',
];

async function resetDatabase() {
  console.log('Connecting to database and executing full reset...');

  const tableList = tables.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} CASCADE;`);

  console.log('Successfully truncated all application tables.\nVerifying counts:');

  const counts = {
    users: await prisma.user.count(),
    events: await prisma.event.count(),
    categories: await prisma.category.count(),
    registrations: await prisma.registration.count(),
    tickets: await prisma.ticket.count(),
    ticketTypes: await prisma.ticketType.count(),
    eventSessions: await prisma.eventSession.count(),
    inventoryReservations: await prisma.inventoryReservation.count(),
    paymentAttempts: await prisma.paymentAttempt.count(),
    paymentExceptions: await prisma.paymentException.count(),
    adminAuditLogs: await prisma.adminAuditLog.count(),
    checkIns: await prisma.checkIn.count(),
    organizerApplications: await prisma.organizerApplication.count(),
    organizerApplicationCategories: await prisma.organizerApplicationCategory.count(),
    adminNotificationReads: await prisma.adminNotificationRead.count(),
    organizerNotificationReads: await prisma.organizerNotificationRead.count(),
  };

  console.log(JSON.stringify(counts, null, 2));
}

resetDatabase()
  .catch((err) => {
    console.error('Reset failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

