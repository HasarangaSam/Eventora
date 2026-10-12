# Eventora Backend — NestJS Architecture & Engineering Reference

> Enterprise-grade event ticketing API built with **NestJS 12**, **TypeScript**, **Prisma ORM**, and **PostgreSQL (Supabase)**. Engineered for high concurrency, financial consistency, zero-trust role-based authorization, and resilient asynchronous processing.

---

## Architecture & System Design

```
                     ┌──────────────────────────────────────────────┐
                     │            Client (React 19 / Axios)         │
                     │          Bearer Token (Clerk JWT)            │
                     └──────────────────────┬───────────────────────┘
                                            │
                                            ▼
                     ┌──────────────────────────────────────────────┐
                     │              NestJS Guard Chain              │
                     │   1. ClerkAuthGuard (JWT + Party Check)     │
                     │   2. AccountGuard (Active DB User Resolution)│
                     │   3. RolesGuard (Server-Side Role Assertion) │
                     │   4. OrganizerApplicationGuard (Approved)    │
                     └──────────────────────┬───────────────────────┘
                                            │
                      ┌─────────────────────┼─────────────────────┐
                      ▼                     ▼                     ▼
               ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
               │ Registrations│      │   Payments   │      │   Check-ins  │
               │  & Inventory │      │   & Webhooks │      │  & QR Tokens │
               └──────┬───────┘      └──────┬───────┘      └──────┬───────┘
                      │                     │                     │
                      └─────────────────────┼─────────────────────┘
                                            ▼
                     ┌──────────────────────────────────────────────┐
                     │          Prisma 7 / PostgreSQL Adapter       │
                     │    Row-Level Locking (FOR UPDATE SKIP LOCKED)│
                     │     ACID Transactions & Snapshot Isolation   │
                     └──────────────────────┬───────────────────────┘
                                            │
                      ┌─────────────────────┼─────────────────────┐
                      ▼                     ▼                     ▼
               ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
               │ PostgreSQL   │      │ Outbox Email │      │  PayHere PGW │
               │ Supabase DB  │      │ Worker (SMTP)│      │  Signatures  │
               └──────────────┘      └──────────────┘      └──────────────┘
```

---

## Core Engineering Principles & Implementation Depth

### 1. High-Concurrency Inventory Reservations (`FOR UPDATE SKIP LOCKED`)
Preventing overselling in ticketing systems requires absolute serialization of reservation requests:
- **Atomicity:** When an attendee initiates a registration (`POST /api/registrations`), inventory is locked and reserved inside a single database transaction.
- **Locking Pattern:** `Event.ticketsReserved` and `TicketType.quantityReserved` are incremented concurrently with validation checks on capacity and ticket supply.
- **Database-Clock Expiry:** Held reservations expire strictly based on the database engine's timestamp (`CURRENT_TIMESTAMP + interval '10 minutes'`), immune to application server clock drift.
- **Background Reclamation:** A recurring worker safely reclaims expired reservation holds using `SELECT ... FOR UPDATE SKIP LOCKED`, preventing deadlocks and competing lock contention.

### 2. Idempotent Checkout & Payment Reconciliation
- **Idempotency Keys:** Registration requests mandate a client-supplied `Idempotency-Key` header, returning existing reservations if retried.
- **PayHere Signature Verification:** Webhook notifications (`POST /api/webhooks/payhere/notify`) verify incoming MD5 message signatures using `crypto.timingSafeEqual` against the merchant secret before processing any state change.
- **Fulfillability Verification:** Even upon verified payment success, if a reservation expired prior to the webhook callback, Eventora verifies available capacity. If fulfillable, tickets are issued; if oversold, the payment is logged to `PaymentException` for audit rather than corrupting inventory counts.

### 3. Cryptographically Signed QR Tickets
- **Zero Token Storage:** Raw QR tokens are never persisted in the database.
- **HMAC Generation:** `token = HMAC-SHA256(TICKET_QR_SECRET, "eventora-ticket:" + reference)` (base64url encoded).
- **Secure Storage:** The database stores only `SHA-256(token)`.
- **Timing-Attack Resistance:** Door validation recomputes the HMAC and performs constant-time equality checks (`timingSafeEqual`) on both the token and the hash.

### 4. Resilient Transactional Outbox Pattern for Emails
- **Guaranteed Delivery:** Email records are created inside the exact same database transaction as the business event (payment confirmation, organizer application decision, or event cancellation).
- **Asynchronous Worker:** The outbox processor executes every 30 seconds, locks pending records with `FOR UPDATE SKIP LOCKED`, and dispatches emails via Gmail SMTP with inline CID QR code attachments.
- **Exponential Backoff:** Configured with bounded retries (max 5 attempts, capping at 1 hour) and sanitized failure codes (`SMTP_DELIVERY_FAILED`).

### 5. Multi-Tier Rate Limiting & Bot Prevention (`@nestjs/throttler`)
- **Dual Throttler Architecture:** Configured with a 15 req/sec burst limiter and a 100 req/min baseline sustained limiter.
- **Session-Aware Tracking:** `AppThrottlerGuard` isolates buckets by authenticated Bearer session token signatures when present, preventing false-positive blocking across shared NATs/corporate Wi-Fi networks, while falling back to normalized IP for anonymous traffic.
- **Scalper & Bot Protection:** High-risk mutation routes (`POST /api/registrations`) are throttled to 10 requests per minute to prevent inventory hold hogging.
- **Webhook Immunity:** Critical payment gateway and identity webhooks carry `@SkipThrottle()` so external state synchronization is never dropped.

---

## Directory Structure & Modules

```
backend/
├── src/
│   ├── analytics/               # Aggregations, revenue stats, sales trends
│   ├── auth/                    # Clerk JWT verification, guards, user sync webhooks
│   ├── categories/              # Category CRUD with cascade protection
│   ├── checkins/                # Live door scanning, attendance logging, validation
│   ├── email/                   # Outbox worker, HTML templates (inline CID QR)
│   ├── events/                  # Catalog, organizer studio, admin cancellation
│   ├── organizer-applications/  # Application workflows, KYC fields, approval transactions
│   ├── payments/                # PayHere hash generation, webhook processing, exceptions
│   ├── prisma/                  # PrismaClient wrapper & PostgreSQL adapter setup
│   ├── registrations/           # Inventory holds, lock-based reservation engine
│   ├── tickets/                 # Ticket generation, QR token signing & rendering
│   ├── app.module.ts            # Root module registering all sub-domains
│   └── main.ts                  # NestJS bootstrap, raw body buffers, global prefix
├── prisma/
│   ├── migrations/              # Version-controlled SQL migrations
│   └── schema.prisma            # Prisma schema (15 models, Decimal money types)
├── scripts/
│   └── provision-admin.ts       # CLI-only secure admin bootstrapper
├── test/                        # Vitest E2E & unit test suites
└── vitest.config.ts             # Vitest configuration
```

---

## Database Models & Schema Highlights

Managed via **Prisma 7** targeting PostgreSQL:

- **`User`**: Database identity synced from Clerk, maintaining authoritative `role` (`ATTENDEE`, `ORGANIZER`, `ADMIN`) and `status` (`ACTIVE`, `DEACTIVATED`).
- **`Event` & `EventSession`**: Complete event lifecycle management (`DRAFT`, `PUBLISHED`, `CANCELLED`, `COMPLETED`), venue geodata, and structured agenda sessions.
- **`TicketType`**: Tiered ticket options (VIP, General, Early Bird) with price in `DECIMAL(12,2)` and inventory bounds.
- **`InventoryReservation`**: Ephemeral 10-minute hold ledger backed by database timestamps.
- **`Registration` & `PaymentAttempt`**: Attendee order state tracking with unique merchant references and idempotency keys.
- **`Ticket` & `CheckIn`**: Digital ticket records storing reference identifiers, hashed tokens, and strict single-entry check-in records.
- **`EmailDelivery`**: Outbox queue maintaining delivery state, attempt logs, error categorization, and retry schedules.

---

## Security Model & Guard Execution Chain

All secured API routes traverse a multi-layered guard pipeline:

1. **`ClerkAuthGuard`**: Decodes and verifies the Clerk JWT signature and confirms the `azp` (Authorized Party) matches `FRONTEND_ORIGIN`.
2. **`AccountGuard`**: Queries PostgreSQL for the user matching `clerkUserId`. Rejects requests from non-existent or `DEACTIVATED` accounts.
3. **`RolesGuard`**: Reads `@Roles(...)` metadata and verifies the user's database-persisted role. Client claims are completely ignored.
4. **`OrganizerApplicationGuard`**: Enforces that organizers have a verified, `APPROVED` application on record before modifying events.

---

## Testing & Quality Assurance

Eventora utilizes **Vitest** for unit and end-to-end integration testing:

```bash
# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Execute E2E suite
npm run test:e2e

# Generate test coverage report
npm run test:cov

# Run fast type-aware oxlint
npm run lint
```

---

## Setup & Local Development

### 1. Prerequisites
- Node.js 20+
- PostgreSQL database (e.g., Supabase Session Pooler)
- Clerk account
- PayHere merchant sandbox credentials

### 2. Environment Configuration
Copy `.env.example` to `.env` and populate all variables:
```bash
cp .env.example .env
```

Key environment variables:
```dotenv
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?pgbouncer=true
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
FRONTEND_ORIGIN=http://localhost:5173
TICKET_QR_SECRET=replace-with-minimum-32-byte-cryptographic-secret
PAYHERE_MERCHANT_ID=1220000
PAYHERE_MERCHANT_SECRET=your_merchant_secret
PAYHERE_ENVIRONMENT=sandbox
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
EMAIL_FROM="Eventora" <your-email@gmail.com>
```

### 3. Database Migration & Client Generation
```bash
npm run prisma:validate
npm run prisma:generate
npm run db:deploy
```

### 4. Bootstrapping First Admin
Admin privileges cannot be granted through the web interface. Provision the initial admin via CLI:
```bash
npm run admin:provision -- user_clerk_user_id
```

### 5. Running the API
```bash
# Development mode with hot-reload
npm run start:dev

# Production build & execution
npm run build
npm run start:prod
```
The API listens on port `3000` (or `PORT` if specified) under the `/api` prefix.
