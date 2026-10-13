# Eventora — Premium Events & Ticketing Platform

**Version 1**

> A full-stack, production-grade event ticketing platform built with NestJS, React 19, PostgreSQL (Supabase), Clerk auth, and PayHere payments. Designed with security-first principles, transactional inventory management, and a premium consumer UI.

### 🎯 Key Engineering Highlights for Recruiters & Technical Reviewers
- **Concurrency Control & Zero Overselling:** Guaranteed transactional inventory locking via PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` combined with strict database-clock reservation expiry (10-minute hold window).
- **Cryptographic Security & Timing Safety:** HMAC-SHA256 signed ticket QR tokens with SHA-256 storage hashes; `crypto.timingSafeEqual` prevents timing attacks on both ticket check-in and PayHere gateway webhook signatures.
- **Transactional Outbox Pattern:** High-reliability email delivery pipeline committed atomically with business transactions, processed asynchronously by a resilient background worker with exponential backoff and inline CID QR rendering.
- **Zero-Trust RBAC Pipeline:** Multi-tier server-side authorization cascade (`ClerkAuthGuard` → `AccountGuard` → `RolesGuard` → `OrganizerApplicationGuard`). Roles are strictly database-owned; client claims are never trusted.
- **Multi-Tier Rate Limiting & Scalper Protection:** Global burst (15 req/s) and sustained (100 req/m) throttling via `@nestjs/throttler` with Bearer token session isolation and strict limits on ticket reservations to prevent scalping bots.
- **Role-Based Workspaces:** Public event browsing is separated from practical organizer and admin workspaces, with clear navigation, responsive tables, operational summaries, and a stable loading state while signed-in roles are resolved.
- **Actionable Notifications:** Admins and organizers get role-scoped activity feeds, unread counts, and persistent per-account mark-as-read controls. Organizer updates cover bookings, payment issues, capacity milestones, and platform cancellations.
- **Event Operations:** Organizers can manage events, review participant and sales details, and run camera-based or manual ticket check-in with `@zxing/browser`.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Key Engineering Highlights](#key-engineering-highlights)
- [Backend Modules](#backend-modules)
- [Frontend Pages & Routes](#frontend-pages--routes)
- [Database Schema](#database-schema)
- [Security Model](#security-model)
- [Payment Integration](#payment-integration)
- [Transactional Email](#transactional-email)
- [QR Ticket System](#qr-ticket-system)
- [Analytics & Dashboards](#analytics--dashboards)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Scripts Reference](#scripts-reference)
- [Further Documentation](#further-documentation)

---

## Project Overview

Eventora is a multi-role event ticketing platform with three distinct user personas:

| Role | Capabilities |
|---|---|
| **Attendee** | Browse events, purchase tickets, view QR ticket wallet, check registration & payment status |
| **Organizer** | Create and publish events, manage ticket types, review event-specific participants and sales, track attendance, manage notifications, and run door check-in |
| **Admin** | Review organizer applications, monitor platform activity, manage accounts and categories, review events, payments, and reports |

Roles are **database-owned** and enforced server-side — the frontend never supplies or influences authorization context.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Browser (React 19 / Vite)              │
│  Public Routes        Attendee        Organizer   Admin   │
│  /  /discover         /account        /organizer  /admin  │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTPS / Axios (Bearer token)
                         ▼
┌──────────────────────────────────────────────────────────┐
│              NestJS API  (port 3000)                      │
│  ClerkAuthGuard → AccountGuard → RolesGuard               │
│                                                           │
│  Auth  │ Events  │ Registrations │ Payments │ Tickets     │
│  Users │ Checkins│ Analytics     │ Email    │ Organizer   │
└────────────────────────┬─────────────────────────────────┘
                         │ Prisma 7 + @prisma/adapter-pg
                         ▼
┌──────────────────────────────────────────────────────────┐
│         Supabase PostgreSQL (Session Pooler)              │
│  15 core tables · DECIMAL(12,2) money · DB-clock expiry   │
└──────────────────────────────────────────────────────────┘
         │                    │                │
    Clerk Auth          PayHere PGWC      Cloudinary CDN
  (identity/JWT)       (payments)         (event covers)
         │                    │
    Gmail SMTP          ngrok (dev)
  (email outbox)
```

---

## Tech Stack

### Backend
| Technology | Version | Purpose |
|---|---|---|
| **NestJS** | ^12 | API framework, DI, guards, decorators |
| **TypeScript** | ^6 | Static typing throughout |
| **Prisma ORM** | ^7.10 | Schema, migrations, type-safe DB client |
| **@prisma/adapter-pg** | ^7.10 | PostgreSQL native driver adapter |
| **PostgreSQL** | Supabase | Primary data store |
| **@clerk/backend** | ^3.23 | JWT verification, user sync webhooks |
| **nodemailer** | ^10 | Gmail SMTP transactional email delivery |
| **qrcode** | ^1.5 | QR code image generation (PNG buffer) |
| **cloudinary** | ^2 | Event cover image upload & CDN |
| **Vitest** | ^4 | Unit & E2E test runner |
| **oxlint** | ^1 | Fast Rust-based linter |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| **React** | ^19.2 | UI library |
| **TypeScript** | ~6.0 | Type safety |
| **Vite** | ^8.3 | Build tool & dev server |
| **React Router** | ^8.4 | Client-side routing |
| **Axios** | ^1.20 | HTTP client with bearer token injection |
| **@clerk/react** | ^6.17 | Authentication UI & session management |
| **Recharts** | ^3.10 | Analytics charts (Area, Bar, Pie) |
| **@zxing/browser** | ^0.2 | Camera-based QR code scanning |
| **Tailwind CSS** | ^4.3 | Utility-first styling across the frontend |

---

## Key Engineering Highlights

### 1. Transactional Inventory with `SELECT … FOR UPDATE SKIP LOCKED`
Registration creation and checkout both use PostgreSQL row-level locking. The `InventoryService.reserve()` method atomically increments `ticketsReserved` on the `Event` row and `quantityReserved` on the `TicketType` row inside the same transaction — only if availability constraints hold. Competing concurrent requests serialize correctly; no overselling is possible.

```sql
-- Simplified reservation lock
UPDATE "Event"
SET "ticketsReserved" = "ticketsReserved" + $quantity
WHERE "id" = $eventId
  AND "status" = 'PUBLISHED'
  AND (capacity IS NULL OR "ticketsReserved" + "ticketsSold" + $quantity <= capacity)
RETURNING "id"
```

### 2. Idempotent Operations Throughout
- Registrations use client-supplied `Idempotency-Key` headers; duplicate requests return the existing registration.
- Email outbox rows carry a stable idempotency key committed in the same transaction as the triggering event (payment confirmed, application decided, event cancelled).
- PayHere webhook handler deduplicates by `merchantReference`; duplicate `SUCCEEDED` notifications do not double-issue tickets.

### 3. Database-Clock Reservation Expiry
Reservation rows are created with `expiresAt = CURRENT_TIMESTAMP + interval '10 minutes'` — the database supplies the clock, not the application server. A background worker polls every 60 seconds using `SELECT … FOR UPDATE SKIP LOCKED` to safely release held reservations even under multiple application instances.

### 4. HMAC-SHA256 Ticket QR Signing
QR tokens are never stored in the database. Instead:
1. A random `reference` is generated per ticket.
2. `HMAC-SHA256(secret, "eventora-ticket:{reference}")` produces the token — `base64url` encoded.
3. Only the `SHA-256(token)` hash is stored in the database.
4. Verification uses `timingSafeEqual` for both the hash comparison and token comparison, preventing timing attacks.

### 5. Fulfillability-Aware Payment Reconciliation
Late or duplicate PayHere webhooks are handled gracefully:
- If a verified `SUCCEEDED` notification arrives after the reservation has expired, Eventora checks current inventory.
- If fulfillable: commits inventory, confirms registration, issues tickets atomically.
- If **not** fulfillable: records a `PaymentException` — the verified payment is preserved for audit without corrupting inventory or issuing invalid tickets.

### 6. Role Escalation Prevention
- `ClerkAuthGuard` → `AccountGuard` → `RolesGuard` runs in strict order.
- The Clerk webhook upsert **deliberately excludes** `role` and `status` from update fields.
- Profile sync at `/api/auth/me` never elevates roles.
- Admin provisioning is CLI-only (`npm run admin:provision`) and refuses to run if an admin already exists.
- Organizers additionally need an `APPROVED` organizer application checked at the service layer.

### 7. Database-Backed Email Outbox Worker
Email delivery uses a PostgreSQL outbox pattern:
- Email rows are written **in the same transaction** as the business event (payment, decision, cancellation).
- A background `setInterval` worker claims batches of `PENDING` rows using `FOR UPDATE SKIP LOCKED` to prevent duplicate delivery across instances.
- Exponential back-off (30s → 1h cap) with bounded retries (5 attempts max).
- Failure codes are sanitized (`SMTP_DELIVERY_FAILED`, etc.) — raw SMTP errors never reach the database.

### 8. PayHere Webhook Signature Verification
```
md5sig = uppercase(MD5(
  merchant_id + order_id + amount + currency + status_code + uppercase(MD5(merchant_secret))
))
```
Verification uses `timingSafeEqual` (constant-time comparison). Only after verification does the handler inspect or change payment state.

---

## Backend Modules

```
backend/src/
├── auth/                   # Clerk JWT guard, account guard, roles guard, webhook sync
├── analytics/              # Role-scoped dashboard aggregates, monthly sales trend
├── categories/             # Public reads + admin CRUD (protected deletion)
├── checkins/               # QR validation + check-in commit (transactional, timing-safe)
├── email/                  # PostgreSQL outbox worker + rich HTML email templates
├── events/                 # Public catalog, organizer event management, notifications, admin oversight
├── organizer-applications/ # Application submission, admin review, transactional approval
├── payments/               # PayHere checkout form gen, webhook handling, reconciliation
├── prisma/                 # Shared PrismaService (OnModuleInit lifecycle)
├── registrations/          # Registration create, inventory service, expiry worker
└── tickets/                # Ticket list/detail, QR image generation
```

### Key API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/events` | Public | Paginated event catalog with search, filter, sort |
| `GET` | `/api/events/featured` | Public | Featured published events |
| `GET` | `/api/events/:id` | Public | Event detail with sessions + ticket types |
| `GET` | `/api/categories` | Public | Active event categories |
| `POST` | `/api/registrations` | Attendee | Create registration + reserve inventory (idempotent) |
| `GET` | `/api/registrations/me` | Attendee | Own registration history |
| `POST` | `/api/payments/:id/checkout` | Attendee | Generate PayHere form fields |
| `GET` | `/api/tickets/me` | Attendee | Ticket wallet with QR images |
| `POST` | `/api/check-ins/validate` | Organizer | Validate QR/reference without recording |
| `POST` | `/api/check-ins` | Organizer | Commit attendance (transactional) |
| `GET` | `/api/organizer/events` | Organizer | Own events list |
| `POST` | `/api/organizer/events` | Organizer | Create draft event |
| `PATCH` | `/api/organizer/events/:id/publish` | Organizer | Publish (validates completeness) |
| `GET` | `/api/organizer/dashboard` | Organizer | KPIs: events, registrations, tickets, revenue |
| `GET` | `/api/organizer/analytics/sales` | Organizer | Monthly gross sales trend |
| `GET` | `/api/organizer/notifications` | Organizer | Recent bookings, payment issues, event milestones, and unread count for owned events |
| `PATCH` | `/api/organizer/notifications/read` | Organizer | Mark one or more updates as read |
| `GET` | `/api/organizer/events/:eventId/participants` | Organizer | Event-scoped participant list and registration details |
| `GET` | `/api/organizer/events/:eventId/analytics` | Organizer | Event sales, registration, and attendance report |
| `GET` | `/api/admin/dashboard` | Admin | Platform-wide KPIs |
| `GET` | `/api/admin/events` | Admin | Latest 100 platform events |
| `PATCH` | `/api/admin/events/:id/cancel` | Admin | Cancel + notify attendees |
| `GET` | `/api/organizer-applications` | Admin | Application queue, optionally filtered by status |
| `PATCH` | `/api/organizer-applications/:applicationId/decision` | Admin | Approve or reject an application |
| `GET` | `/api/admin/notifications` | Admin | Recent platform activity, pending applications, and unread count |
| `PATCH` | `/api/admin/notifications/read` | Admin | Mark one or more updates as read |
| `POST` | `/api/webhooks/payhere/notify` | Public (verified) | PayHere payment notification |
| `POST` | `/api/auth/webhooks/clerk` | Public (signed) | Clerk user sync webhook |

---

## Frontend Pages & Routes

```
/                           Home page — editorial hero, how-to-register, recent events
/discover                   Searchable + filterable event catalog (URL query params)
/events/:eventId            Event detail — schedule, ticket types, purchase flow
/sign-in  /sign-up          Clerk-hosted auth pages (custom styled wrapper)
/account                    Attendee account and registration overview
/tickets                    Attendee ticket wallet with private QR codes
/checkout/result            Post-payment result (reads server state, never URL params)
/checkout/cancelled         Cancelled checkout handler

/admin                      Admin shell (sidebar layout)
  /admin                    Platform overview and admin task links
  /admin/applications        Organizer application review
  /admin/notifications       Recent activity with unread and mark-as-read controls
  /admin/events              Platform event review and cancellation
  /admin/users               Account management and role/status controls
  /admin/categories          Category management
  /admin/payments            Verified sales and payment attempts
  /admin/reports             Registration and attendance reports

/organizer                  Organizer shell (sidebar layout)
  /organizer                 Organizer overview and event health
  /organizer/events          Event management, ticket types, schedule, publish/cancel
  /organizer/participants    Event-filtered participant and ticket details
  /organizer/sales           Event selection and sales overview
  /organizer/sales/:eventId  Event-specific sales and participant report
  /organizer/notifications   Bookings and event updates with unread filters and read controls
  /organizer/checkin         Check-in hub → per-event scanner
  /organizer/profile         Organizer profile

/organizer/events/:id/check-in  Live check-in page (QR camera + manual entry)
```

### Frontend Feature Breakdown

| Feature Directory | Key Components |
|---|---|
| `features/auth/` | `AccountPage`, `AuthPage`, `CurrentUserContext` (role provider), `useAuthenticatedApi` hook |
| `features/events/` | `DiscoveryPage` (filtered catalog), `EventDetailPage` (ticket purchase) |
| `features/organizer/` | Event management, event-scoped sales and participant reports, notifications, check-in, and organizer overview |
| `features/admin/` | Platform overview, application review, event/account/category management, payment and attendance reports, and notifications |
| `features/tickets/` | `TicketsPage` — ticket wallet with QR code display |
| `features/analytics/` | `DashboardShell` (role-aware sidebar layout), role-scoped dashboard panels |
| `features/payments/` | `CheckoutResultPage` — polls server state post-redirect |
| `features/home/` | Rich editorial landing page with registration guide, featured events |

### Frontend Structure

The frontend keeps route setup, shared interface elements, and product features in clear, focused folders:

```text
frontend/src/
  app/                Route definitions and app-level composition
  assets/             Local image and static assets
  components/
    layout/            Public site shell, page introductions, Eventora logo
    ui/                Reusable buttons, icons, dialogs, notifications
  features/            Home, events, auth, tickets, payments, analytics, admin, organizer
  lib/                 Shared API client and data helpers
  App.tsx              Root application setup
  index.css            Tailwind entry point, theme tokens, and global browser styles
```

Page and component presentation primarily uses Tailwind utility classes, with inline styles retained where values are calculated at runtime, such as chart colors and progress widths. `index.css` contains the Tailwind entry point, shared theme values, browser-wide defaults, focus states, and global animations. Shared layout and UI components keep navigation, branding, and interaction patterns consistent across the public site and workspace pages.

---

## Database Schema

**16 Prisma models** across 6 database migrations:

```
User                 — Clerk identity + Eventora role/status
AdminNotificationRead — Per-admin notification read state
OrganizerNotificationRead — Per-organizer notification read state
OrganizerApplication — Application lifecycle + decision audit
Category             — Event categories (soft-disable, no cascade delete)
Event                — Full event lifecycle (DRAFT→PUBLISHED→CANCELLED/COMPLETED)
EventSession         — Schedule entries (within event dates, non-bookable)
TicketType           — Priced ticket types with inventory counters
InventoryReservation — 10-minute holds (DB-clock expiry, FOR UPDATE SKIP LOCKED)
Registration         — Attendee purchase record + price snapshot
PaymentAttempt       — Per-attempt payment tracking (INITIATED→SUCCEEDED/FAILED/CHARGEDBACK)
PaymentException     — Unfulfillable verified payments (audit, no auto-refund)
Ticket               — Issued digital tickets (reference + QR token hash)
CheckIn              — Attendance record (unique per ticket)
EmailDelivery        — Outbox rows with retry metadata + safe error codes
```

**Financial precision:** All money amounts use `DECIMAL(12,2)` — no floating point.

**Migrations applied:**
- `init` — core schema with check constraints
- `pending_organizer_application_unique` — one pending application per applicant
- `payhere_provider_amount` — verified PayHere payment details
- `organizer_application_review_details` — application review fields
- `admin_notification_reads` — per-admin mark-as-read state
- `organizer_notification_reads` — per-organizer mark-as-read state

---

## Security Model

### Authentication & Authorization Chain
```
Request
  → ClerkAuthGuard     (verifies JWT, checks authorized party = FRONTEND_ORIGIN)
  → AccountGuard       (resolves database user, rejects DEACTIVATED accounts)
  → RolesGuard         (checks database role — never browser-supplied)
  → [Organizer routes] OrganizerApplicationGuard (checks APPROVED application)
  → Service layer      (re-verifies ownership: organizerId, userId, eventId scoping)
```

### Notable Security Properties
- **No self-service role elevation** — only CLI provisioning for first admin
- **Timing-safe comparisons** everywhere sensitive (`timingSafeEqual` for QR tokens, PayHere signature)
- **Raw body preservation** for webhook signature verification (Clerk + PayHere)
- **QR token never stored** — only `SHA-256(HMAC-SHA256(secret, ref))` in DB
- **Price snapshot on registration** — price is copied from ticket type at reservation time, locked in the DB, never re-read from the request
- **Event/attendee data isolation** — check-in responses never expose attendee contact details or internal IDs
- **Cloudinary uploads** — file signature checked (magic bytes) before streaming; DB updated only after successful upload; cleanup on DB failure
- **No payment status from URL** — checkout result page always reads from the authenticated API
- **Notification ownership** — organizer notifications and read state are scoped to the signed-in organizer and their own events

---

## Payment Integration

Eventora uses **PayHere Hosted Checkout** (Sri Lanka's leading payment gateway):

1. **Checkout form generation** — Backend signs the checkout hash using `PAYHERE_MERCHANT_SECRET`. The browser receives only pre-signed form fields and posts them to PayHere.
2. **Webhook verification** — `POST /api/webhooks/payhere/notify` verifies `md5sig` using constant-time comparison before any state change.
3. **Fulfillability check** — After verification, the handler locks the `Event` + `TicketType` rows and checks if the reservation is still valid before committing inventory.
4. **Late success handling** — Verified but unfulfillable payments are stored as `PaymentException` without inventory mutation.

Supported currencies: **LKR**, **USD**

---

## Transactional Email

All emails use a **PostgreSQL outbox pattern** — the email row is committed in the same database transaction as the triggering event:

| Email Type | Trigger | Contents |
|---|---|---|
| `PURCHASE_CONFIRMATION` | Payment `SUCCEEDED` + inventory committed | Confirmation, event details, QR codes, and ticket link |
| `ORGANIZER_APPLICATION_DECISION` | Admin approves/rejects application | Decision, optional note, and organizer link when approved |
| `EVENT_CANCELLATION` | Admin or organizer cancels event | Cancellation details, optional reason, refund information, and ticket link |

**Template design:** Emails use concise copy and table-based, inline-CSS HTML for compatibility with common email clients. Decorative emoji and promotional copy are avoided.

**Delivery:** Gmail SMTP via nodemailer with exponential backoff (30s → 1h cap, max 5 attempts). Error codes are sanitized before storage.

---

## QR Ticket System

```
Registration confirmed (payment succeeded)
  ↓
For each purchased ticket:
  reference = random UUID-based string
  token     = HMAC-SHA256(TICKET_QR_SECRET, "eventora-ticket:{reference}") → base64url
  hash      = SHA-256(token) → stored in DB (Ticket.qrTokenHash)
  
QR image = QRCode.toBuffer(token) → PNG, sent as inline email attachment

At check-in:
  Organizer scans QR or enters reference
  Backend: compute token from reference using same secret
           compute hash of that token
           timingSafeEqual(computed_hash, stored_hash)  ← timing-safe
           timingSafeEqual(computed_token, scanned_token) ← timing-safe
           if valid: lock ticket row FOR UPDATE, insert CheckIn, update Ticket.status
```

The QR secret (`TICKET_QR_SECRET`) must be at least 32 bytes. Never in frontend builds. Never in logs.

---

## Analytics & Dashboards

### Admin Dashboard (`/admin`)
Live platform totals from `GET /api/admin/dashboard`:
- Accounts, events, confirmed registrations, and checked-in tickets
- Events grouped by status and verified sales grouped by currency
- Direct links to application review, event oversight, accounts, payments, reports, and categories
- `/admin/notifications` lists platform activity and supports persistent unread/read state

### Organizer Dashboard (`/organizer`)
Live event summaries from `GET /api/organizer/analytics/events`:
- Event count, confirmed registrations, valid tickets, and verified sales grouped by currency
- Upcoming events, items needing attention, and direct event management links
- `/organizer/participants` filters participant records by event and registration, payment, and entry status
- `/organizer/sales` selects an event before showing its sales report
- `/organizer/notifications` shows recent bookings, payment exceptions, near-capacity events, and admin cancellations; read state persists per organizer

### Attendee Dashboard (`/account`)
Live data from `GET /api/attendee/dashboard`:
- Recent registrations with event details + payment status
- Active ticket count + upcoming event dates
- Quick access to ticket wallet

All analytics use **real database aggregates** — no mocked or fabricated data. Currency totals remain separate (no cross-currency summing).

---

## Getting Started

### Prerequisites
- Node.js 20+
- npm
- Supabase PostgreSQL project (Session Pooler URL)
- Clerk application (publishable key, secret key, webhook secret)

### 1. Clone & Install

```sh
git clone <repo>
cd eventora

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies  
cd ../frontend && npm install
```

### 2. Configure Environment

```sh
# Backend
cp backend/.env.example backend/.env
# → Set DATABASE_URL, CLERK_*, PAYHERE_*, GMAIL_*, CLOUDINARY_*, TICKET_QR_SECRET

# Frontend
cp frontend/.env.example frontend/.env.local
# → Set VITE_CLERK_PUBLISHABLE_KEY
```

### 3. Database Setup

```sh
cd backend
npm run prisma:validate   # validate schema
npm run prisma:generate   # generate Prisma client
npm run db:deploy         # apply migrations to Supabase
```

### 4. Provision Initial Admin

After first sign-in via the frontend:

```sh
cd backend
npm run admin:provision -- user_<clerk-id>
```

### 5. Start Development Servers

```sh
# Terminal 1 — Backend (port 3000, hot reload)
cd backend && npm run start:dev

# Terminal 2 — Frontend (port 5173, HMR)
cd frontend && npm run dev
```

### 6. Configure Webhooks (for local development)

```sh
# Expose backend via ngrok
ngrok http 3000

# Set in Clerk Dashboard:
# Webhook URL: https://<ngrok-host>/api/auth/webhooks/clerk
# Events: user.created, user.updated, user.deleted

# Set for PayHere (in backend/.env):
# PAYHERE_NOTIFY_URL=https://<ngrok-host>/api/webhooks/payhere/notify
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase Session Pooler connection string |
| `CLERK_PUBLISHABLE_KEY` | ✅ | Clerk public key |
| `CLERK_SECRET_KEY` | ✅ | Clerk secret key (server-only) |
| `CLERK_WEBHOOK_SIGNING_SECRET` | ✅ | Webhook signature verification |
| `FRONTEND_ORIGIN` | ✅ | Exact frontend URL (e.g. `http://localhost:5173`) |
| `TICKET_QR_SECRET` | ✅ | HMAC key for QR tokens (min 32 chars, stable) |
| `PAYHERE_MERCHANT_ID` | ✅ | PayHere merchant ID |
| `PAYHERE_MERCHANT_SECRET` | ✅ | PayHere merchant secret |
| `PAYHERE_ENVIRONMENT` | ✅ | `sandbox` or `live` |
| `PAYHERE_NOTIFY_URL` | ✅ | Public HTTPS URL for payment notifications |
| `PAYHERE_RETURN_URL` | ✅ | Frontend URL after successful payment |
| `PAYHERE_CANCEL_URL` | ✅ | Frontend URL after cancelled payment |
| `GMAIL_USER` | ✅ Email | Gmail address |
| `GMAIL_APP_PASSWORD` | ✅ Email | 16-character Google App Password |
| `EMAIL_FROM` | ✅ Email | `"Eventora" <noreply@...>` format |
| `CLOUDINARY_CLOUD_NAME` | ✅ Covers | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | ✅ Covers | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | ✅ Covers | Cloudinary API secret |
| `PORT` | Optional | API port (default: `3000`) |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk publishable key (safe to expose) |
| `VITE_API_BASE_URL` | Optional | Backend URL (default: `http://localhost:3000/api`) |

---

## Scripts Reference

### Backend (`cd backend`)

```sh
npm run start:dev        # Start with hot reload (watch mode)
npm run start:prod       # Start compiled production build
npm run build            # Compile TypeScript + generate Prisma client
npm run test             # Run unit tests (Vitest)
npm run test:e2e         # Run E2E tests
npm run test:cov         # Coverage report
npm run prisma:generate  # Regenerate Prisma client from schema
npm run prisma:validate  # Validate schema.prisma
npm run db:migrate       # Create + apply a new development migration
npm run db:deploy        # Apply committed migrations (production)
npm run admin:provision -- <clerk-user-id>  # Bootstrap initial admin
npm run lint             # oxlint type-aware linting
```

### Frontend (`cd frontend`)

```sh
npm run dev              # Vite dev server with HMR (port 5173)
npm run build            # TypeScript check + Vite production build
npm run preview          # Preview production build locally
npm run lint             # oxlint
```

---

## Further Documentation

| Document | Contents |
|---|---|
| [`backend/README.md`](backend/README.md) | NestJS architecture, concurrency models, Prisma ORM, outbox worker, security guards |
| [`frontend/README.md`](frontend/README.md) | React 19 UI architecture, Recharts analytics, ZXing camera scanner, design system |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Module breakdown, API catalog, frontend route inventory |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Schema design, migration history, Prisma setup |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Auth chain, role guards, inventory protection, QR security |
| [`docs/PAYMENTS.md`](docs/PAYMENTS.md) | PayHere integration, webhook verification, local testing |
| [`docs/EMAIL.md`](docs/EMAIL.md) | Email outbox, Gmail SMTP setup, template descriptions |
| [`docs/FRONTEND.md`](docs/FRONTEND.md) | Frontend structure, design system, UX guidelines |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Full local setup guide, webhook configuration, admin provisioning |

---

## License

Private / Unlicensed — all rights reserved.
