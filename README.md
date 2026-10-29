# Eventora — Event Discovery & Ticketing Platform

Eventora is a full-stack event discovery and ticketing web application built with **NestJS**, **React 19**, **PostgreSQL (Prisma 7)**, **Clerk Authentication**, and **PayHere Payments**.

I built this project to move beyond basic CRUD applications and learn how to solve practical engineering challenges—such as preventing overselling during concurrent ticket purchases, handling payment gateway webhooks reliably, delivering transactional emails using the outbox pattern, and designing secure, server-enforced role permissions.

---

## 📌 Table of Contents

- [Overview & Features](#overview--features)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [How It Works: Core Engineering Concepts](#how-it-works-core-engineering-concepts)
  - [1. Preventing Overselling with Concurrency Control](#1-preventing-overselling-with-concurrency-control)
  - [2. Reliable Email Delivery via Transactional Outbox](#2-reliable-email-delivery-via-transactional-outbox)
  - [3. Cryptographic Ticket QR Generation & Validation](#3-cryptographic-ticket-qr-generation--validation)
  - [4. Safe Payment Webhook Reconciliation](#4-safe-payment-webhook-reconciliation)
  - [5. Zero-Trust Role Authorization](#5-zero-trust-role-authorization)
- [Docker & Containerization](#docker--containerization)
- [Project Structure](#project-structure)
- [Local Setup & Getting Started](#local-setup--getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [What I Learned](#what-i-learned)

---

## Overview & Features

Eventora supports three user roles, each with clear boundaries:

| Role | What They Can Do |
|---|---|
| **Attendee** | Browse published events, search and filter by category, reserve tickets with a 10-minute price/inventory hold, complete PayHere checkout, and access their personal QR ticket wallet. |
| **Organizer** | Apply for organizer status, create events and schedule sessions, define tiered ticket pricing and capacities, track live ticket sales and attendee check-ins, and scan QR tickets at the venue via webcam or mobile camera. |
| **Admin** | Review and approve/reject organizer applications, monitor platform-wide metrics and payments, manage event categories, and review or cancel events if necessary. |

---

## Architecture & Tech Stack

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Frontend (React 19 + Vite)                      │
│   Public Catalog          Attendee Wallet         Organizer / Admin    │
│   /discover               /tickets, /account      /organizer, /admin   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS + Bearer Token (Clerk JWT)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Backend API (NestJS 12)                        │
│   ClerkAuthGuard ──► AccountGuard ──► RolesGuard ──► AppThrottlerGuard │
│                                                                        │
│   Events Module   · Registrations & Inventory  · Payments (PayHere)    │
│   Tickets & QR    · Check-ins (Camera/Manual)  · Transactional Outbox  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Prisma ORM 7 + @prisma/adapter-pg
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database (Supabase / Local)                │
│   15 Relational Tables · Row Locks (FOR UPDATE) · Decimal(12,2) Money  │
└────────────────────────────────────────────────────────────────────────┘
         │                                │                       │
    Clerk Identity                 PayHere Gateway          Nodemailer SMTP
    (User Auth & JWT)            (Hosted Checkout)          (Email Delivery)
```

### Technologies Used

- **Backend:** NestJS 12, TypeScript, Prisma ORM 7 (`@prisma/adapter-pg`), PostgreSQL, `@nestjs/throttler`, Nodemailer, QRCode.
- **Frontend:** React 19, TypeScript, Vite, React Router 8, Tailwind CSS v4, Lucide Icons, Recharts, `@zxing/browser` (camera scanner).
- **External Services:** Clerk (authentication), PayHere (payments), Cloudinary (event image hosting), Gmail SMTP (transactional email).
- **Testing & Tooling:** Vitest (unit & integration tests), Oxlint (linter), Docker & Docker Compose, GitHub Actions (CI pipeline).

---

## How It Works: Core Engineering Concepts

Rather than relying purely on default framework assumptions, I wanted to understand the failure modes that happen in real ticketing workflows. Here are the main problems I addressed:

### 1. Preventing Overselling with Concurrency Control

When popular tickets go on sale, multiple users click "Buy" at the exact same moment. If the system reads the remaining stock and then updates it in separate steps, two simultaneous requests might both think 1 ticket is left, selling 2 tickets for 1 seat.

* **Guarded SQL Updates:** Inventory reservation uses an atomic update directly in SQL:
  ```sql
  UPDATE "TicketType"
  SET "quantityReserved" = "quantityReserved" + $quantity, "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = $ticketTypeId
    AND "isActive" = TRUE
    AND "quantityReserved" + "quantitySold" + $quantity <= "quantity"
  RETURNING "price", "currency";
  ```
  PostgreSQL evaluates this condition atomically on the locked row. If another transaction took the last seat milliseconds before, the update matches 0 rows and fails safely with `TICKET_UNAVAILABLE`.
* **Deterministic Lock Hierarchy:** When confirming payments or releasing held inventory across multiple tables, locks are acquired in a consistent order:
  $$\text{Event} \longrightarrow \text{TicketType} \longrightarrow \text{InventoryReservation} \longrightarrow \text{PaymentAttempt}$$
  This prevents database deadlocks when concurrent processes touch the same resources.
* **10-Minute Hold Expiry:** Reserved tickets are held for 10 minutes (`expiresAt = CURRENT_TIMESTAMP + interval '10 minutes'`) using the database clock rather than the application server clock, avoiding clock-skew issues. A background worker periodically cleans up uncompleted reservations.

### 2. Reliable Email Delivery via Transactional Outbox

Normally, sending an email directly inside an HTTP handler introduces the "Dual-Write Problem": if the SMTP server fails or times out after payment succeeded, either the payment rolls back or the user never gets their tickets.

* **The Outbox Table:** When a purchase or cancellation commits, an `EmailDelivery` row is inserted **in the exact same database transaction** as the ticket/order confirmation.
* **Safe Polling with `SKIP LOCKED`:** A background worker claims pending emails in batches using:
  ```sql
  SELECT "id" FROM "EmailDelivery"
  WHERE "status" = 'PENDING' AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= CURRENT_TIMESTAMP)
  ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 10;
  ```
  `SKIP LOCKED` ensures that if multiple backend instances run concurrently, they skip locked rows without waiting or duplicating email sends.
* **Exponential Backoff:** If delivery fails, attempts retry with exponential delays (`30s`, `60s`, `120s`...) up to 5 attempts before marking as terminal.

### 3. Cryptographic Ticket QR Generation & Validation

Tickets need to be verifiable at the door without allowing attendees to forge codes or change a ticket ID to gain entry.

* **HMAC Token Signing:** The QR token contains an HMAC-SHA256 signature calculated from the ticket reference and a server-side secret (`TICKET_QR_SECRET`).
* **Hashed Storage (Defense-in-Depth):** The database does **not** store the HMAC token in plain text; it only stores `SHA-256(token)`. If the database were ever compromised, an attacker would still not have the tokens needed to forge valid QRs.
* **Timing-Safe Comparison:** At the door, `crypto.timingSafeEqual` is used to verify signatures and tokens, preventing timing-attack vulnerabilities.
* **Double Check-In Guard:** When an organizer scans a ticket, the ticket row is locked with `FOR UPDATE` inside a database transaction. If two door attendants scan the same QR code simultaneously, only one transaction commits; the second receives `ALREADY_CHECKED_IN`.

### 4. Safe Payment Webhook Reconciliation

Payment gateways communicate via asynchronous webhooks that can arrive late, out of order, or multiple times.

* **Signature Verification:** Incoming PayHere callbacks verify the MD5 signature using `timingSafeEqual` before reading or changing any payment data.
* **Idempotency:** If PayHere sends the same webhook notification twice, the handler detects that the attempt is already `SUCCEEDED` and returns success immediately without incrementing inventory or issuing duplicate tickets.
* **Late Payment Handling:** If a buyer completes payment after their 10-minute reservation hold has expired, Eventora checks if unsold capacity remains:
  * If capacity is still available, it fulfills the tickets.
  * If the event sold out while the user was delayed, it records a `PaymentException` (`LATE_PAYMENT_UNFULFILLED`) so administrators can process a refund without overselling the event.

### 5. Zero-Trust Role Authorization

* **Database-Owned Roles:** Clerk is used only for authentication identity (who the user is). Roles (`ATTENDEE`, `ORGANIZER`, `ADMIN`) and account statuses (`ACTIVE`, `DEACTIVATED`) are stored and managed exclusively in PostgreSQL.
* **Tamper-Proof Sync:** When syncing profiles from Clerk, the backend deliberately avoids updating the `role` or `status` columns, preventing users from elevating their privileges via client-side metadata.
* **Guard Cascade:** Protected routes pass through:
  `ClerkAuthGuard` (validates JWT) $\longrightarrow$ `AccountGuard` (checks DB account is active) $\longrightarrow$ `RolesGuard` (verifies required role and approved organizer status).

---

## Docker & Containerization

Eventora is containerized using multi-stage Docker builds and an orchestrated local setup:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          docker-compose.yml                            │
│                                                                        │
│   ┌────────────────────┐   ┌───────────────────┐   ┌────────────────┐  │
│   │   postgres:16      │   │  NestJS Backend   │   │  React Nginx   │  │
│   │   (Database)       │◄──┼── (API port 3000) ┼───┼─  (port 80)    │  │
│   │   Port 5432        │   │   Node 22 Runner  │   │  SPA Fallback  │  │
│   └────────────────────┘   └───────────────────┘   └────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

- **Backend Multi-Stage Build (`backend/Dockerfile`):**
  - **Stage 1 (Builder):** Installs packages, generates the Prisma client with OpenSSL, compiles TypeScript, and prunes development dependencies.
  - **Stage 2 (Runner):** Uses a minimal `node:22-alpine` image running as an unprivileged `node` user with `dumb-init` to handle process termination signals (`SIGTERM`) gracefully.
- **Frontend Multi-Stage Build & Nginx (`frontend/Dockerfile`):**
  - Builds the React 19 single-page application into optimized static assets (`dist/`).
  - Serves files using a lightweight `nginx:alpine` image—Node.js is completely excluded from the production image.
  - **SPA Fallback Rule (`frontend/nginx.conf`):** Uses `try_files $uri $uri/ /index.html;` so direct page refreshes on client-side routes (like `/discover` or `/organizer`) return `/index.html` instead of an HTTP 404.
- **Local Compose Orchestration (`docker-compose.yml`):**
  Spins up the full stack (local PostgreSQL, NestJS API, and Nginx frontend) with automated health checks using one command:
  ```bash
  docker compose up --build
  ```

---

## Project Structure

```text
eventora/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Database models, relations, and indexes
│   │   └── migrations/         # Version-controlled SQL migrations
│   ├── src/
│   │   ├── auth/               # Clerk JWT authentication & role guards
│   │   ├── events/             # Public catalog & organizer event management
│   │   ├── registrations/      # Reservation logic & concurrency management
│   │   ├── payments/           # PayHere checkout fields & webhook handling
│   │   ├── tickets/            # HMAC QR signing & ticket queries
│   │   ├── checkins/           # Venue entry validation (camera & manual)
│   │   ├── email/              # Transactional outbox worker & HTML templates
│   │   ├── analytics/          # Sales aggregates & organizer metrics
│   │   └── main.ts             # Application entry point & configuration
│   └── test/                   # Vitest unit and integration tests
│
├── frontend/
│   ├── src/
│   │   ├── app/                # Route configuration & shell layouts
│   │   ├── components/         # Reusable buttons, badges, dialogs, navbars
│   │   ├── features/           # Feature pages (events, organizer, admin, tickets)
│   │   └── lib/                # Axios API client with Clerk token injection
│   └── nginx.conf              # SPA fallback configuration for container deployment
│
├── .github/workflows/          # GitHub Actions CI pipeline
└── docker-compose.yml          # Local containerized setup (Postgres + API + Web)
```

---

## Local Setup & Getting Started

### Option A: Docker Compose (Fastest & Zero Local DB Setup)

If you have Docker Desktop installed, you can run the database, backend, and frontend together:

```bash
# 1. Clone the repository
git clone https://github.com/HasarangaSam/Eventora.git
cd Eventora

# 2. Build and run all services
docker compose up --build
```
- Frontend: `http://localhost:80`
- Backend API: `http://localhost:3000/api`
- Health check: `http://localhost:3000/api/health`

---

### Option B: Manual Local Development (Node.js)

#### Prerequisites
- **Node.js** (v20 or v22 recommended)
- **npm**
- **Git**
- A free **Supabase** project (or local PostgreSQL instance)
- A free **Clerk** account for authentication

#### Step 1: Clone the Repository

```bash
git clone https://github.com/HasarangaSam/Eventora.git
cd Eventora
```

---

#### Step 2: Configure Backend

```bash
cd backend
npm install
cp .env.example .env
```

Open `backend/.env` and fill in your keys:
- `DATABASE_URL`: Your PostgreSQL connection string.
- `CLERK_PUBLISHABLE_KEY` & `CLERK_SECRET_KEY`: From your Clerk dashboard.
- `TICKET_QR_SECRET`: Any random string of 32+ characters for signing ticket QRs.
- `FRONTEND_ORIGIN`: `http://localhost:5173` (for local development).

Run database migrations and generate the Prisma client:

```bash
npx prisma generate
npx prisma migrate deploy
```

Start the backend development server:

```bash
npm run start:dev
```
The backend will run on `http://localhost:3000/api`. You can test health at `http://localhost:3000/api/health`.

---

#### Step 3: Configure Frontend

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env.local
```

Open `frontend/.env.local` and add your Clerk publishable key:
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_BASE_URL=http://localhost:3000/api
```

Start the frontend development server:

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

> **Note:** If you start the frontend before the backend is running, Vite's proxy will show `[vite] http proxy error: ECONNREFUSED`. Simply ensure the backend is running on port 3000 in your first terminal.

---

#### Step 4: Provisioning an Admin User (Optional)

1. Sign up on the frontend using your Clerk account.
2. Find your Clerk User ID (e.g., `user_2t...`) in your Clerk Dashboard or your database `User` table.
3. In the `backend/` directory, run:
   ```bash
   npm run admin:provision -- user_your_clerk_id
   ```
4. Refresh your browser; you will now have access to the `/admin` portal.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase Session Pooler or local) |
| `CLERK_PUBLISHABLE_KEY` | Clerk public key |
| `CLERK_SECRET_KEY` | Clerk secret key for backend token verification |
| `FRONTEND_ORIGIN` | Allowed origin for CORS (e.g. `http://localhost:5173`) |
| `TICKET_QR_SECRET` | Secret key used to HMAC-sign ticket QR codes (minimum 32 chars) |
| `PAYHERE_MERCHANT_ID` | PayHere sandbox merchant ID |
| `PAYHERE_MERCHANT_SECRET` | PayHere merchant secret used for signature verification |
| `PAYHERE_NOTIFY_URL` | Webhook URL where PayHere posts payment status updates |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Optional Gmail SMTP credentials for sending ticket emails |
| `CLOUDINARY_*` | Optional Cloudinary credentials for event cover uploads |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (safe for browser) |
| `VITE_API_BASE_URL` | Backend API URL (default: `http://localhost:3000/api`) |

---

## Available Scripts

### Backend (`backend/`)

- `npm run start:dev` — Start backend in watch mode (NestJS)
- `npm run build` — Compile TypeScript and generate Prisma client
- `npm test` — Run all unit and integration test suites with Vitest (15 test suites, 48 tests)
- `npm run lint` — Lint code with Oxlint
- `npm run prisma:validate` — Check Prisma schema syntax

### Frontend (`frontend/`)

- `npm run dev` — Start Vite local development server
- `npm run build` — Type-check with TypeScript and bundle production assets with Vite
- `npm run lint` — Lint React components with Oxlint
- `npm run preview` — Locally preview the production build

---

## What I Learned & Future Improvements

### Key Takeaways from Building Eventora:
1. **Concurrency is subtle:** Using normal ORM updates for stock counts quickly causes race conditions under load; combining raw SQL conditional updates with ORM relations gave both safety and productivity.
2. **External services fail:** Webhooks and emails can fail independently of database commits. Designing around idempotency and the outbox pattern proved much more reliable than inline API calls.
3. **Security requires layers:** Relying solely on client tokens is fragile. Storing hashed tokens and verifying roles strictly on the server prevented privilege elevation bugs.

## License

This project was built for educational and portfolio purposes. Feel free to explore and learn from the code!
