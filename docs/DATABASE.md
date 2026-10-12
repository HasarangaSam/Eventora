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
- Payment attempts preserve merchant and provider references; payment exceptions are recorded without defining an unresolved administrative resolution workflow.
- Tickets store a hash of the QR token, never the token itself. A unique check-in row per ticket supports duplicate-safe check-in transactions.
- Email delivery rows carry an idempotency key and retry state; they are not the source of truth for purchases.

Prisma models express foreign keys and indexes. The initial SQL migration adds check constraints for positive prices/quantities, valid time ranges, ticket counts within capacity, amount snapshots, reservation expiry, and required success timestamps. The application must still reserve/commit/release inventory atomically and keep the event and ticket-type counters in sync. The SQL has been generated and reviewed locally, but has not been applied or exercised against PostgreSQL yet.

## Commands

Run these commands from `backend/`:

```sh
npm run prisma:validate
npm run prisma:generate
npm run db:migrate -- --name init
npm run db:deploy
```

The `migrate dev` command creates and applies a development migration and requires a configured database plus the shadow-database privileges Prisma needs. Review the generated migration before applying it. Production uses committed migrations with `db:deploy`; do not use `db push` against valuable data.
