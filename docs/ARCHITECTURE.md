# Architecture

## Application Boundaries

| Layer | Technology | Details |
|---|---|---|
| **Frontend** | React 19 + Vite 8 + TypeScript 6 | SPA served from port 5173. `App.tsx` defines all routes via React Router v8. Feature code lives under `src/features/`. |
| **Backend** | NestJS 12 + TypeScript 6 | REST API on port 3000. Feature modules in `src/app.module.ts`. Controllers validate input; services contain all business logic. |
| **Database** | Supabase PostgreSQL via Prisma 7 | Schema in `backend/prisma/schema.prisma`. Migrations in `backend/prisma/migrations/`. `@prisma/adapter-pg` (session pooler compatible). |
| **Auth** | Clerk | JWT verification via `@clerk/backend`. Eventora owns `role` and `status` in PostgreSQL — never derived from Clerk. |
| **Payments** | PayHere Hosted Checkout | Backend generates signed checkout form; webhook signature verified server-side before state changes. |
| **Images** | Cloudinary | Organizer event covers. MIME + magic-byte validated before upload. |
| **Email** | Gmail SMTP / nodemailer | PostgreSQL outbox worker, exponential backoff, bounded retries. |

---

## Backend Module Reference

### `AuthModule`
- `ClerkAuthGuard` — verifies Clerk session JWT, checks `authorized_party` against `FRONTEND_ORIGIN`
- `AccountGuard` — resolves database user, rejects `DEACTIVATED` accounts
- `RolesGuard` — enforces database role (`ATTENDEE`, `ORGANIZER`, `ADMIN`)
- `ClerkService` — upsert on `clerkUserId`; **never updates** `role` or `status`
- Clerk webhook at `POST /api/auth/webhooks/clerk` — signature-verified, idempotent user sync; `user.deleted` deactivates (does not delete financial history)
- `GET /api/auth/me` — returns synchronized Eventora user record

### `AnalyticsModule`
- `GET /api/admin/dashboard` — platform KPIs: user counts by role, events by status, registration/payment totals, verified gross sales by currency, attendance rate
- `GET /api/organizer/dashboard` — organizer KPIs: owned events, confirmed registrations, tickets issued, gross sales by currency
- `GET /api/attendee/dashboard` — recent registrations with event/payment status
- `GET /api/admin/analytics/sales` — monthly gross sales trend (12 months)
- `GET /api/organizer/analytics/sales` — organizer-scoped monthly sales trend
- `GET /api/organizer/analytics/attendance` — per-event issued/checked-in counts + overall rate
- `GET /api/organizer/analytics/payments` — payment status breakdown by currency

### `CategoriesModule`
- `GET /api/categories` — active categories (public)
- `GET /api/categories/:id` — by ID or slug (public)
- `GET /api/categories/admin/list` — all categories including disabled (admin)
- `POST /api/categories` — create (admin)
- `PATCH /api/categories/:id` — update / disable (admin)
- `DELETE /api/categories/:id` — refuses while any event references the category

### `EventsModule`
**Public catalog:**
- `GET /api/events` — paginated, searchable, filterable. Params: `page`, `pageSize`, `search`, `categoryId`, `from`, `to`, `sort` (`startAt`/`newest`/`title`), `direction` (`asc`/`desc`). Default: active (not-ended) published events. Response: `{ items, pagination: { total, pageCount } }`.
- `GET /api/events/featured` — curated published events
- `GET /api/events/:id` — full event detail (404 for non-published)
- `GET /api/events/:id/sessions` — schedule entries
- `GET /api/events/:id/ticket-types` — active ticket types with availability

**Organizer event management** (`/api/organizer/events`, requires approved organizer):
- Full CRUD: `POST`, `GET`, `PATCH`, `DELETE` — always scoped to authenticated organizer ID
- `PATCH /publish` — validates: future dates, active category, complete details, ≥1 active paid ticket type with inventory and usable sales window
- `PATCH /unpublish` — blocked after registrations or reservations exist
- `PATCH /cancel` — transactional: releases held reservations, queues `EVENT_CANCELLATION` email per confirmed attendee, preserves history
- Cover upload: `POST /api/organizer/events/:id/cover` — MIME + magic-byte check, streamed to Cloudinary, DB updated after success, cleanup on failure

**Admin event oversight:**
- `GET /api/admin/events` — latest 100 events, optional status filter
- `PATCH /api/admin/events/:id/cancel` — same transactional cancellation; records `cancelledBy` admin identity

### `RegistrationsModule`
- `POST /api/registrations` — requires `Idempotency-Key` header; snapshots price/currency from ticket type; atomically reserves `Event.ticketsReserved` + `TicketType.quantityReserved` + creates `InventoryReservation` (expires in exactly 10 minutes by DB clock); creates `Registration` (PENDING) + `PaymentAttempt` (INITIATED)
- `GET /api/registrations/me` — attendee's own registrations
- `GET /api/registrations/:id` — single registration (attendee-scoped)
- `InventoryService` — background expiry worker (every 60s, `FOR UPDATE SKIP LOCKED`); also called at checkout start to expire due holds

### `PaymentsModule`
- `POST /api/payments/:registrationId/checkout` — verifies active hold, generates unique `merchantReference`, builds signed PayHere form fields, returns `{ url, method, fields }`
- `GET /api/payments/me` — attendee's payment attempts
- `POST /api/webhooks/payhere/notify` — public endpoint; verifies `md5sig` with `timingSafeEqual`; serializes against inventory locks; fulfillable success → commit inventory + confirm registration + issue tickets + queue email; unfulfillable → `PaymentException`; chargeback → `CHARGEDBACK` + `PaymentException`

### `TicketsModule`
- `GET /api/tickets/me` — attendee's tickets (confirmed registration required)
- `GET /api/tickets/:id` — ticket detail + QR image (verifies ownership + confirmed registration + succeeded payment)

### `CheckinsModule`
- `POST /api/check-ins/validate` — validates ticket reference/QR without recording attendance (organizer)
- `POST /api/check-ins` — commits attendance: locks `Event` (shared read) + `Ticket` (update); inserts `CheckIn`; updates `Ticket.status = CHECKED_IN`; unique `CheckIn.ticketId` as final duplicate guard
- `GET /api/organizer/events/:id/check-ins` — paginated check-in history (25/page)
- `GET /api/organizer/events/:id/attendance` — issued/checked-in counts

### `OrganizerApplicationsModule`
- `POST /api/organizer-applications` — requires verified Clerk primary email (fetched server-side); validates org details, categories, experience; server-records agreement timestamp + rules version; partial unique index enforces one pending application per user
- `GET /api/organizer-applications/me` — applicant's own history
- `GET /api/admin/organizer-applications` — full queue with filters (admin)
- `PATCH /api/admin/organizer-applications/:id/approve` — transactional: sets `APPROVED`, promotes user `role = ORGANIZER`, records reviewer + timestamp, queues `ORGANIZER_APPLICATION_DECISION` email
- `PATCH /api/admin/organizer-applications/:id/reject` — same transaction, no role change

### `EmailModule`
- PostgreSQL outbox pattern: email rows committed with triggering event in same transaction
- Background worker: `setInterval(30s)`, `FOR UPDATE SKIP LOCKED` batch of 10
- Three template types: `PURCHASE_CONFIRMATION`, `ORGANIZER_APPLICATION_DECISION`, `EVENT_CANCELLATION`
- Exponential backoff: 30s → 1h cap; max 5 attempts; terminal status `FAILED`
- QR codes embedded inline as `cid:` attachments in purchase confirmation emails

---

## Frontend Route Table

| Route | Component | Auth | Notes |
|---|---|---|---|
| `/` | `HomePage` | Public | Editorial hero, how-to, featured events, FAQ |
| `/discover` | `DiscoveryPage` | Public | URL-param filters: search, category, date, sort |
| `/events/:id` | `EventDetailPage` | Public | Sessions, ticket types, registration + PayHere checkout |
| `/sign-in` | `AuthPage` | Public | Clerk-embedded, custom styled |
| `/sign-up` | `AuthPage` | Public | Clerk-embedded, custom styled |
| `/account` | Role-aware shell | Signed in | Dispatches to role-specific dashboard |
| `/tickets` | `TicketsPage` | Attendee | QR ticket wallet |
| `/checkout/result` | `CheckoutResultPage` | Attendee | Reads server state post-redirect |
| `/checkout/cancelled` | `CheckoutResultPage` | Attendee | Cancelled state handler |
| `/admin` | `AdminPage` | Admin | Sidebar shell |
| `/admin` (overview) | `AdminOverviewPage` | Admin | KPI cards + 4 Recharts charts |
| `/admin/applications` | `AdminApplicationsPage` | Admin | Application review queue |
| `/admin/users` | `AdminUsersPage` | Admin | User list + role/status management |
| `/admin/events` | `AdminEventsPage` | Admin | Event oversight + cancel action |
| `/admin/categories` | `AdminCategoriesPage` | Admin | Category CRUD |
| `/organizer` | `OrganizerOverviewPage` | Organizer | KPI cards + Recharts charts |
| `/organizer/events` | `OrganizerEventsDashboard` | Organizer | Full event CRUD + publish/unpublish/cancel |
| `/organizer/sales` | `OrganizerSalesPage` | Organizer | Revenue analytics |
| `/organizer/checkin` | `OrganizerCheckinHubPage` | Organizer | Per-event check-in selector |
| `/organizer/profile` | `OrganizerProfilePage` | Organizer | Public organizer info |
| `/organizer/events/:id/check-in` | `EventCheckinPage` | Organizer | Live QR scanner (ZXing) + manual entry |

---

## Guard Execution Order

```
HTTP Request
  ↓
ClerkAuthGuard
  Verifies JWT · checks authorized_party
  ↓
AccountGuard
  Resolves User from DB · rejects DEACTIVATED
  ↓
RolesGuard
  Checks User.role from DB (never browser)
  ↓
[Organizer routes only]
OrganizerApplicationGuard
  Checks approved OrganizerApplication exists
  ↓
Service Layer
  Re-verifies ownership (organizerId/userId scoping in every query)
```

---

## Inventory Concurrency Model

```
Registration Request
  ↓
BEGIN TRANSACTION
  ↓
UPDATE Event SET ticketsReserved = ticketsReserved + qty
  WHERE status = PUBLISHED AND startAt > NOW()
  AND (capacity IS NULL OR ticketsReserved + ticketsSold + qty <= capacity)
RETURNING id                          ← fails if 0 rows → EVENT_UNAVAILABLE
  ↓
UPDATE TicketType SET quantityReserved = quantityReserved + qty
  WHERE isActive = TRUE AND price > 0
  AND quantityReserved + quantitySold + qty <= quantity
RETURNING price, currency             ← fails if 0 rows → TICKET_UNAVAILABLE
  ↓
INSERT InventoryReservation (expiresAt = CURRENT_TIMESTAMP + '10 minutes')
INSERT Registration (status = PENDING, totalAmount = price * qty)
INSERT PaymentAttempt (status = INITIATED)
COMMIT
```

Two concurrent requests serialize on the same `Event` row lock — overselling is impossible.
