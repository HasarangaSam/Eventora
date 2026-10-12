# Database and Prisma

Eventora uses Supabase-hosted PostgreSQL through Prisma ORM 7 and `@prisma/adapter-pg`. The schema lives in `backend/prisma/schema.prisma`; Prisma CLI configuration lives in `backend/prisma.config.ts`; migrations belong in `backend/prisma/migrations/`.

## Connection configuration

Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL` to the Supabase **Session pooler** connection string from the project’s Connect dialog (port 5432). Supabase recommends the session pooler for persistent server applications that cannot use a direct IPv6 connection. Do not commit this file. For transaction-pooler deployments, follow Supabase’s prepared-statement guidance and verify the exact URL parameters for the selected mode.

The Prisma config loads `.env` for CLI commands. Schema validation and client generation do not require a live database URL; migrations and application startup do. `PrismaService` uses the configured URL and the PostgreSQL adapter.

## Schema integrity

- Clerk identity is uniquely mapped by `User.clerkUserId`; application role and status live in PostgreSQL.
- Category, event, ticket-type, registration, payment, ticket, and check-in relations use restrictive deletion policies where they carry history.
- Categories can be disabled instead of deleting historical references.
- Ticket price, registration snapshots, and payment amounts use PostgreSQL `DECIMAL(12,2)` rather than floating point.
- Ticket types and events include reserved/sold counters to support later atomic inventory reservations. Reservation rows retain quantity, expiry, and state; the database supplies an expiry exactly 10 minutes after the reservation row is created.
- Payment attempts preserve merchant and provider references plus the amount/currency actually reported by a verified provider notification; payment exceptions are recorded without defining an unresolved administrative resolution workflow.
- Tickets are created in the same transaction that confirms a verified payment and commits inventory. Each purchased item gets an independent random reference and a QR-token hash derived from the stable backend HMAC secret. A unique check-in row per ticket supports duplicate-safe check-in transactions.
- Check-in runs in a transaction that locks the event for a shared read and the selected ticket for update. It inserts one `CheckIn` row and changes `Ticket.status` together; the unique `CheckIn.ticketId` index is a final duplicate guard. Attendance summaries count confirmed non-void tickets and persisted check-in records, retaining historical check-ins if a later payment exception changes payment state.
- Email delivery rows carry a unique idempotency key, status, attempt count, next retry time, and safe failure code; they are not the source of truth for purchases or tickets.
- Organizer applications retain every submission and decision; migration `20261012090000_pending_organizer_application_unique` adds a partial unique index so an applicant can have only one pending application while reapplying after rejection.

Prisma models express foreign keys and indexes. The initial SQL migration adds check constraints for positive prices/quantities, valid time ranges, ticket counts within capacity, amount snapshots, reservation expiry, and required success timestamps. The initial, organizer-application, and PayHere metadata migrations have been applied to the configured Supabase database. Registration and reservation creation run in one interactive transaction; guarded event and ticket-type updates serialize competing reservations, and the database clock supplies the exact shared registration/reservation creation time. A server-side worker releases due holds and expires the pending registration and payment attempt. Verified late PayHere success is reconciled against current inventory and preserved as an exception if it cannot be fulfilled.

## Commands

Run these commands from `backend/`:

```sh
npm run prisma:validate
npm run prisma:generate
npm run db:migrate -- --name init
npm run db:deploy
```

The `migrate dev` command creates and applies a development migration and requires a configured database plus the shadow-database privileges Prisma needs. Review the generated migration before applying it. Production uses committed migrations with `db:deploy`; do not use `db push` against valuable data.
