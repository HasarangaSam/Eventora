# Eventora --- Codex Agent Brief

> **Purpose:** This document is the authoritative project brief for
> Codex and other coding agents working on Eventora. Follow it alongside
> the repository's actual code and configuration. Do not assume a
> feature exists merely because it appears in this plan.

## 1. Mission and working principles

Build **Eventora**, a full-stack event management and paid-ticketing
platform for attendees, organizers, and administrators.

The product must support event discovery, real PayHere ticket purchases,
digital tickets with secure QR codes, and reliable event check-in.
Organizers apply for approval before managing events. Administrators
manage users, organizer applications, categories, events, and platform
analytics.

Priorities, in order:

1.  Correctness of payment, inventory, authorization, and ticketing
    workflows.
2.  Security and preservation of financial and historical records.
3.  Maintainable architecture and readable TypeScript.
4.  Useful, accessible, responsive user experience.
5.  Visual polish without unnecessary complexity.

This is a real integration project. **Do not simulate authentication or
payments.** Build in small, verifiable phases rather than generating the
whole application at once.

### Agent responsibilities

- Inspect the repository, current phase, relevant files, package
  versions, scripts, and tests before making changes.
- Treat existing implementation and the confirmed project rules as the
  source of truth; do not restart or replace working code without a
  concrete reason.
- State the goal and implementation plan before substantial changes.
- Make the smallest complete change that solves the task.
- Provide exact file paths and complete file contents when giving
  implementation instructions to the user.
- Clearly identify files to create, modify, or delete.
- Explain required dependencies and environment variables. Never
  invent credentials or claim a service is configured when it is not.
- Add meaningful comments for non-obvious business rules or
  engineering decisions; avoid comments that merely restate code.
- Run relevant tests and project checks. Report exactly what ran and
  what passed or failed.
- Never claim a feature is complete or verified without evidence.
- If a business rule is genuinely undecided, ask or clearly identify
  the decision needed instead of silently inventing behavior.
- After each phase, summarize the verified state and wait for the
  user's confirmation before proceeding.

## 2. Final technology stack

Use these technologies consistently. Do not add alternatives without a
clear technical reason and approval.

### Frontend

- React 19, TypeScript, Vite
- Tailwind CSS v4
- React Router
- Axios
- `@clerk/react` (Clerk Core 3 integration)
- Zod where appropriate
- React built-in hooks and controlled forms

Do **not** use `@clerk/clerk-react`, Next.js or React Server Component
patterns, TanStack Query/React Query, Zustand, Redux, React Hook Form,
unnecessary global-state libraries, or unnecessary UI component
libraries.

Use feature-oriented modules and smaller components. Handle loading,
empty, error, and success states. Keep types explicit, use accessible
HTML, and follow the installed lint configuration.

### Backend

- Node.js, TypeScript, NestJS
- PostgreSQL hosted by Supabase
- Prisma ORM 7.x
- `@prisma/adapter-pg` and `pg`
- `@nestjs/config`
- `@clerk/backend`
- `class-validator` and `class-transformer`
- Cloudinary Node.js SDK
- NestJS `FileInterceptor`, `@nestjs/platform-express`, and Multer
  integration
- A suitable QR-code generation library
- Gmail and app password for email send

Use NestJS modules, controllers, providers, dependency injection, DTO
validation, guards, and services appropriately. Controllers handle HTTP
concerns; services enforce business rules; Prisma handles database
access. Avoid unnecessary repositories, factories, or abstraction
layers.

### External services

---

Service Responsibility

---

Clerk Authentication, sessions, Google
login, identity management

Supabase PostgreSQL hosting

Cloudinary Event cover image storage and
delivery

PayHere Real ticket payment processing

ngrok Expose local webhook endpoints
during development

Transactional email provider Purchase/ticket emails, organizer
decisions, cancellation
notifications

Upstash Redis Appropriate
notification/purchase-related
support and rate limiting

---

The project brief mentions Gmail as the transactional email provider.
Verify the intended provider and its current supported configuration
before implementing delivery. Do not silently substitute another
provider.

Check official documentation and version compatibility before installing
or upgrading dependencies, especially Clerk Core 3, React 19, Tailwind
CSS v4, NestJS, and Prisma 7.x. Follow Prisma 7 configuration
conventions, not outdated Prisma 5/6 examples.

## 3. Roles, identity, and authorization

Eventora roles are `ATTENDEE`, `ORGANIZER`, and `ADMIN`.

Clerk owns authentication and identity. Eventora's database owns
application role, account activation, and organizer approval.
Authentication does not imply authorization.

### Attendee

Attendees can register/sign in through Clerk, use Google login when
configured, browse and search published events, view event details and
schedules, buy paid tickets, see checkout/payment status, access their
registrations and digital tickets, view QR codes, receive confirmation
emails, and view upcoming/past events.

Attendees **cannot** cancel registrations or request refunds through
Eventora. There is no free-ticket flow.

### Organizer

Users apply to become organizers. An administrator must approve the
application before organizer-management endpoints become available.

Approved, active organizers can manage only their own events; configure
publication, cover images, sessions, and paid ticket types; view event
registrations and relevant attendee information; monitor sales and
payment status; view event analytics; and check tickets in using camera
QR scanning or manual references.

### Admin

Admins can manage users and account status, roles, organizer
applications, categories, events, platform analytics, registrations,
payment records, check-ins, and operational payment exceptions. Admins
can cancel events across the platform.

There is no public administrator registration. Provision the initial
admin through a controlled setup process. Prevent accidental admin
lockout and privilege escalation.

### Required identity flow

1.  The user authenticates through Clerk.
2.  The frontend sends the appropriate bearer token to protected backend
    endpoints.
3.  NestJS verifies the token using `@clerk/backend`.
4.  Eventora idempotently synchronizes the Clerk identity with the
    database.
5.  Store the Clerk user ID in a unique database field.
6.  Resolve role, active status, and organizer approval from trusted
    database records.
7.  Enforce access with backend guards and service-level ownership
    checks.

Never trust frontend-supplied roles, Clerk IDs, emails, prices, totals,
organizer IDs, registration owners, or ownership claims when the backend
can verify them independently. Deactivated Eventora accounts must be
blocked even if their Clerk session is still valid.

Use Clerk webhooks for relevant lifecycle changes. Verify webhook
signatures, tolerate duplicate deliveries, and prevent duplicate user
creation. Use ngrok during local webhook development.

## 4. Domain and database requirements

Design the database around business integrity, not merely frontend
screens. The schema must support:

- `User`
- Organizer application
- Category
- Event
- Event session
- Ticket type
- Registration
- Payment and payment attempts/references
- Inventory reservation or equivalent reservation state
- Individual digital tickets
- Check-in
- Email delivery tracking where needed

Use appropriate enums, relationships, foreign keys, unique constraints,
indexes, timestamps, and deletion policies. Preserve historical
registrations, payments, tickets, and category references. Use precise
monetary representations; never use floating-point arithmetic for
payment totals. Use transactions for operations that must succeed or
fail together.

Use Supabase PostgreSQL with Prisma ORM 7.x, `@prisma/adapter-pg`, and
`pg`. Verify the installed Prisma version and current official setup
instructions before configuring the schema, generated client,
migrations, and connection.

## 5. Events, sessions, and categories

### Events

Events should contain organizer ownership, title, description, category,
venue/location, start/end times, cover image URL and Cloudinary public
ID, publication status, and timestamps.

Supported event statuses include:

- `DRAFT`
- `PUBLISHED`
- `CANCELLED`
- `COMPLETED`

The backend controls valid state transitions. Public APIs expose only
published events and must not leak drafts or private organizer data.
Public event discovery supports server-side pagination,
title/relevant-detail search, category and date filtering, sorting,
event details, schedules, ticket types, prices, and availability.

Organizers can create and manage only their own events. Validate event
dates, required information, publication conditions, and ticket
configuration. Restrict edits after sales begin if they could invalidate
registrations or payments. Do not hard-delete events with historical
registration/payment records.

### Cover images

Use Cloudinary. Validate image type and file size on the backend, store
the returned URL and public ID in PostgreSQL, verify event ownership
before changing images, replace assets safely, avoid orphaned uploads,
and never expose Cloudinary secrets to the browser.

### Sessions

Sessions are informational schedule entries only; there is no session
booking or session-level ticket purchase. Sessions may contain title,
description, start/end time, venue/room, and optional speaker
information. Validate session times against the event schedule and
protect records tied to existing event history.

### Categories

Public users can view categories. Admins create, update, and manage
them. Do not delete a category referenced by historical records; prefer
archiving/disabling it where deletion would damage history.

## 6. Paid ticket types, inventory, and checkout

Every ticket type must have a price greater than zero. Free tickets are
not supported.

Ticket types may include name, description, price, currency, quantity,
sales start/end, and active status. The backend enforces valid
prices/currency, sales windows, activation, purchase quantity limits,
inventory, configured event capacity, organizer ownership, and
restrictions on modifying sold ticket types.

### Concurrency-safe reservation

When checkout begins:

1.  Authenticate the user.
2.  Validate ticket type and quantity.
3.  Calculate price and total from trusted database records.
4.  Validate the sales window, ticket status, and inventory.
5.  Reserve inventory using a concurrency-safe database
    transaction/control strategy.
6.  Create a pending registration and associated payment attempt.
7.  Set reservation expiry to **10 minutes after creation**.
8.  Prepare PayHere checkout data on the backend.
9.  Confirm the registration and issue tickets only after verified
    successful payment.

Never use a frontend availability check or a simple read-then-write
sequence as the inventory protection mechanism. Simultaneous purchases
must not oversell inventory. Protect duplicate checkout attempts.

### Reservation expiry and late payment

Expired pending reservations must release inventory safely through a
reliable server-side mechanism, such as a NestJS scheduled task, and
expiry must also be reconciled during payment processing. A browser
countdown is not authoritative.

Handle races between expiry and payment confirmation.

If a valid PayHere payment arrives after the reservation expires: -
Verify the notification. - Reconcile the payment and reservation
state. - Do not issue tickets if doing so would oversell the event. - Do
not discard a real successful payment or falsely mark it failed. -
Record a payment exception for admin review.

Automated refunds are out of scope. Unresolved payment exceptions
require an explicit administrative process.

## 7. Real PayHere integration

Use real PayHere checkout. Never implement simulated payments, fake
success buttons, or shortcuts that mark registrations paid without
verification.

The frontend requests checkout from NestJS. The backend builds PayHere
checkout data using trusted registration/payment records. Keep merchant
secrets and payment credentials on the backend.

Verify server notifications according to current official PayHere
requirements. Validate merchant/payment reference, registration
association, amount, currency, payment status, and required
signature/hash. A successful browser redirect is **not** proof of
payment.

Only a verified server notification can trigger confirmed registration
and ticket issuance.

Payment notification processing must be signature-verified, idempotent,
duplicate-safe, safe against unexpected notification order and
concurrent processing, and protected against amount/registration
mismatches. Repeated successful notifications must not issue duplicate
tickets, decrement inventory twice, or send duplicate confirmation
emails. Preserve payment and registration history.

Use ngrok to expose the local notification endpoint during development.
Document local webhook setup and configure production webhook
URLs/security appropriately.

## 8. Digital tickets and check-in

### Ticket issuance

Only after verified payment success:

1.  Confirm payment.
2.  Confirm registration.
3.  Create one individual ticket per purchased ticket.
4.  Generate unique ticket references and secure, unguessable QR tokens.
5.  Make tickets available to the attendee.
6.  Trigger confirmation/ticket email delivery.

Each ticket has its own reference and status. QR payloads must not
contain sensitive attendee information or expose internal database IDs
unnecessarily. Verify ticket ownership before returning private ticket
details or QR representations. A QR image alone is not proof of payment
or validity.

### Check-in

Organizers can scan a ticket QR code using a compatible browser camera
or enter a ticket reference manually. Both methods must use the same
backend validation.

The backend verifies: - Authenticated, active, approved organizer. -
Organizer owns the event. - Ticket exists and belongs to that event. -
Registration/payment is confirmed. - Ticket status permits check-in. -
Ticket has not already been checked in. - Applicable event check-in
rules.

Check-in must be atomic and concurrency-safe. Two simultaneous scans
must not produce two successful check-ins. Return clear outcomes such as
valid, checked in, already checked in, invalid, payment unconfirmed,
wrong event, or unauthorized organizer without leaking sensitive
information. Camera scanning must explain permission requirements and
always offer manual entry.

## 9. Event cancellation and email

### Cancellation policy: cancel and notify; no refunds

When an authorized organizer or admin cancels an event: 1. Mark it
`CANCELLED`. 2. Preserve registrations, payments, tickets, and
historical records. 3. Block new purchases. 4. Notify registered
attendees by email. 5. Show cancellation status in relevant interfaces. 6. Preserve accurate historical analytics.

Cancellation must not reverse confirmed payments. Do not implement
attendee cancellation, attendee refund requests, or automated refunds.
Audit cancellation appropriately.

### Transactional email

Required messages: - Purchase confirmation after verified payment. -
Digital ticket details after ticket issuance. - Organizer application
decision. - Event cancellation.

Email is not the source of truth for payments or tickets. Track delivery
status/failures and allow retries without duplicating registrations,
payments, or tickets. Use a reliable retry strategy or database-backed
outbox if justified. Never send tickets before verified payment.

## 10. API conventions and endpoint map

Base URL: `http://localhost:3000/api/`.

Use REST endpoints and consistent JSON responses. Apply a global API
prefix, correct CORS, DTO validation, appropriate HTTP status codes,
consistent error formatting, pagination/filtering, UTC timestamps,
centralized configuration, and safe logging. Never return stack traces,
credentials, secrets, or database connection details to the frontend.

Implement only necessary endpoints and keep behavior consistent; do not
create duplicate routes for the same functionality.

---

Area Method and endpoint Access

---

Health `GET /health` Public

Auth `GET /auth/me` Authenticated

Auth `POST /auth/sync` Authenticated;
idempotent

Users `GET /users/me`, `PATCH /users/me` Authenticated; profile
fields only

Users `GET /users`, `GET /users/:userId` Admin

Users `PATCH /users/:userId/status`, `PATCH /users/:userId/role` Admin

Organizer applications `POST /organizer-applications` Eligible authenticated
user

Organizer applications `GET /organizer-applications/me` Authenticated

Organizer applications `GET /organizer-applications`, Admin
`GET /organizer-applications/:applicationId`,  
 `PATCH /organizer-applications/:applicationId/decision`

Categories `GET /categories`, `GET /categories/:categoryId` Public

Categories `POST /categories`, `PATCH /categories/:categoryId`, Admin; deletion only
`DELETE /categories/:categoryId` when safe

Public events `GET /events`, `GET /events/featured`, `GET /events/:eventId` Public; published
events only

Public `GET /events/:eventId/sessions`, `GET /events/:eventId/ticket-types` Public; published
schedules/tickets events only

Organizer events `POST /organizer/events`, `GET /organizer/events`, Approved organizer;
`GET /organizer/events/:eventId`, `PATCH /organizer/events/:eventId` ownership enforced

Event status `PATCH /organizer/events/:eventId/publish`, Owner; only when
`PATCH /organizer/events/:eventId/unpublish`, permitted
`PATCH /organizer/events/:eventId/cancel`,  
 `DELETE /organizer/events/:eventId`

Admin events Necessary event-management operations Admin

Cover images `POST /organizer/events/:eventId/cover-image`, Event owner
`DELETE /organizer/events/:eventId/cover-image`

Sessions `POST /organizer/events/:eventId/sessions`, Owner; public schedule
`GET /organizer/events/:eventId/sessions`, via public event
`GET /organizer/events/:eventId/sessions/:sessionId`, endpoints
`PATCH /organizer/events/:eventId/sessions/:sessionId`,  
 `DELETE /organizer/events/:eventId/sessions/:sessionId`

Ticket types `POST /organizer/events/:eventId/ticket-types`, Owner or public viewer
`GET /organizer/events/:eventId/ticket-types`, of published event as
`GET /organizer/events/:eventId/ticket-types/:ticketTypeId`, appropriate
`PATCH /organizer/events/:eventId/ticket-types/:ticketTypeId`,  
 `PATCH /organizer/events/:eventId/ticket-types/:ticketTypeId/status`,  
 `DELETE /organizer/events/:eventId/ticket-types/:ticketTypeId`

Registrations `POST /registrations`, `GET /registrations/me`, Authenticated attendee;
`GET /registrations/:registrationId` detail access for
owner, authorized
organizer, or admin

Organizer registrations `GET /organizer/events/:eventId/registrations`, Event owner
`GET /organizer/events/:eventId/attendees`

Payments `POST /payments/:registrationId/checkout`, `GET /payments/:paymentId`, Registration/payment
`GET /payments/me` owner or authorized
organizer/admin as
applicable

PayHere webhook `POST /webhooks/payhere/notify` PayHere server
notification; backend
verification required

Tickets `GET /tickets/me`, `GET /tickets/:ticketId`, Owner; authorized
`GET /tickets/:ticketId/qr` organizer/admin for
ticket details as
appropriate

Check-in `POST /check-ins/validate`, `POST /check-ins` Approved organizer;
event ownership
enforced

Check-in reports `GET /organizer/events/:eventId/check-ins`, Event owner
`GET /organizer/events/:eventId/attendance`

Attendee dashboard `GET /attendee/dashboard` Authenticated attendee

Organizer dashboard `GET /organizer/dashboard` Approved organizer

Organizer analytics `GET /organizer/analytics/overview`, `/sales`, `/registrations`, Approved organizer; own
`/attendance` events only

Event analytics `GET /organizer/events/:eventId/analytics` Event owner

Admin dashboard `GET /admin/dashboard` Admin

Admin analytics `GET /admin/analytics/overview`, `/sales`, `/registrations`, Admin
`/attendance`, `/payments`

---

For analytics endpoints shown with abbreviated paths, implement the full
route under `/api/admin/analytics/` or `/api/organizer/analytics/`
as applicable. Keep route naming consistent with existing code.

Registration request example:

```json
{
  "ticketTypeId": "ticket_type_id",
  "quantity": 2
}
```

The backend calculates the price and total from trusted database
records.

## 11. Analytics

### Attendee dashboard

- Upcoming and past events.
- Active tickets.
- Recent registrations.
- Payment statuses.

### Organizer dashboard

- Total events and counts by status.
- Tickets sold and confirmed registrations.
- Gross confirmed ticket sales.
- Sales trends and payment-status breakdown.
- Attendance/check-in rates and event-specific performance.

Organizers may see only data for their own events.

### Admin dashboard

- Total/active users and attendee/organizer counts.
- Pending organizer applications.
- Event counts by status.
- Registration counts and confirmed ticket sales.
- Payment outcomes.
- Attendance/check-in statistics.

Calculate financial analytics from verified payment records. Label
figures as **gross sales**, not profit or organizer payout. Use
efficient aggregate queries and pagination; do not load every ticket or
registration into application memory just to compute metrics.

## 12. Frontend experience and required pages

The design must be a distinctive, modern event-discovery and ticketing
product, not a generic AI-generated SaaS template.

### Visual direction

Use a balanced orange-themed palette:

- Primary orange: `#F97316`
- Deep orange: `#C2410C`
- Warm off-white: `#FFFBF7`
- White surfaces: `#FFFFFF`
- Primary text: `#1C1917`
- Secondary text: `#78716C`
- Borders: `#E7E5E4`
- Subtle orange background: `#FFF0E5`

These are initial design tokens. Do not make every element orange. Use
orange for primary actions, selected navigation, and restrained accents.
Ensure accessible contrast for all status colors.

Use a coherent, readable typography system, consistent spacing, aligned
page boundaries, sensible maximum widths, and responsive layouts
intentionally designed for smaller screens. Use borders, subtle
backgrounds, and restrained shadows only where useful.

Avoid generic three-card feature sections, repeated gradients, glowing
buttons, decorative blobs, random abstract shapes, excessive glass
effects, repetitive dashboard cards, emoji as an icon system, fake
statistics, empty oversized hero sections, unnecessary sections,
excessive rounded corners, giant pill buttons, and gratuitous animation.

Use a consistent icon library such as `lucide-react` if icons are
needed. Use real Cloudinary event cover images and appropriate
fallbacks, consistent image ratios/cropping, and useful alt text. Do not
rely on broken external URLs or random placeholders.

Provide hover/focus/loading/disabled states, validation feedback,
success/error messages, empty states, loading indicators, confirmation
for destructive actions, pagination/filter feedback, and accessible
menus/dialogs. Use semantic HTML, labels, keyboard navigation, visible
focus, sufficient contrast, accessible icon-only buttons, reduced-motion
support, and usable camera permission/manual-entry flows.

The home page must include a **hero image** and prioritize useful event
discovery/navigation over generic marketing copy.

### Required pages

**Public** - Home - Browse events and category-filtered listings - Event
details and schedule - Clerk sign-in/sign-up entry points - Organizer
application entry point and application status

**Attendee** - Dashboard - My registrations - My tickets and ticket
details - Payment/checkout status - Profile or Clerk account management

**Organizer** - Dashboard - My events, create/edit event - Event
sessions and ticket-type management - Event registrations and attendee
list - QR check-in scanner and manual ticket lookup - Event analytics -
Application status when relevant

**Admin** - Dashboard - User management - Organizer applications -
Category management - Event management - Registration/payment
monitoring - Attendance/check-in reports - Platform analytics

Use shared layouts/components when they improve consistency, but do not
force all roles into the same navigation or dashboard.

### Suggested frontend structure

Create files progressively as features are implemented; do not create
empty speculative modules.

```text
frontend/src/
├── api/                 # Axios configuration and API clients
├── components/
│   ├── ui/
│   └── forms/
├── features/
│   ├── auth/
│   ├── events/
│   ├── sessions/
│   ├── categories/
│   ├── ticket-types/
│   ├── registrations/
│   ├── payments/
│   ├── tickets/
│   ├── check-ins/
│   ├── users/
│   └── analytics/
├── layouts/
├── pages/
├── routes/
├── hooks/
├── lib/
├── types/
├── App.tsx
├── index.css
└── main.tsx
```

Use Axios for API calls, Zod for appropriate frontend validation, and
Clerk's React integration for session-aware UI. Frontend route
protection improves UX but never replaces backend authorization.

## 13. Backend structure and conventions

Create NestJS modules progressively rather than generating all modules
at the start.

```text
backend/src/
├── auth/
├── users/
├── organizer-applications/
├── categories/
├── events/
├── sessions/
├── ticket-types/
├── registrations/
├── payments/
├── tickets/
├── check-ins/
├── analytics/
├── webhooks/
├── cloudinary/
├── prisma/
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── dto/
│   └── filters/
├── app.module.ts
└── main.ts
```

Use DTOs to validate input, guards for authentication/access
requirements, and services for business logic. Keep controllers readable
and services cohesive. Add shared utilities only when they solve a real
repeated problem.

Configure the global prefix `/api`, frontend-origin CORS, UTC
timestamps, centralized environment configuration, appropriate logging,
pagination/filtering, and consistent JSON error responses. Never expose
stack traces, credentials, payment secrets, or database connection
details.

## 14. Mandatory React/TypeScript quality checks

Before frontend changes, inspect actual installed versions,
`package.json`, TypeScript, Vite, and ESLint configuration. All changes
must be compatible with installed React 19 and Tailwind v4.

- Use supported APIs and correct explicit types; avoid `any` unless
  justified.
- Fix lint errors instead of suppressing them.
- Do not add `eslint-disable` merely to silence warnings.
- Do not use `@ts-ignore` or careless type assertions to hide errors.
- Handle effect dependencies, asynchronous errors, loading states,
  stale closures, and race conditions.
- Avoid effects for values that can be calculated during render.
- Never set state or perform side effects during render.
- Use stable keys and clean up timers, listeners, subscriptions, and
  camera resources.
- Avoid unnecessary memoization and unused
  imports/variables/functions.
- Use accessible markup and labeled controls.

Run the scripts actually defined in the repository. Common checks may
include:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Adapt to the real package scripts and TypeScript project configuration.
Do not claim a check passed unless it was run successfully. Fix relevant
errors before declaring a phase complete.

## 15. Security baseline

Always enforce: - Backend Clerk token verification. - Database-backed
role, active-account, and organizer-approval checks. - Event ownership
checks. - Input validation and safe error handling. - Backend-only
secrets and credentials. - Official PayHere notification verification. -
Idempotent payment handling. - Concurrency-safe inventory
reservations. - Safe expiry/late-payment reconciliation. - Ticket
issuance only after verified payment. - Ticket ownership and secure
QR-token access. - Atomic one-time check-in. - Preservation of
financial/history records. - Upload type/size limits. - Rate limits on
sensitive endpoints where appropriate. - No sensitive credentials or
personal information in logs. - HTTPS in production, correct CORS, and
secure webhooks.

Frontend route guards are not the security boundary. The backend is.

## 16. Testing expectations

Test business invariants, not only HTTP success responses.

### Authentication and authorization

- Reject unauthenticated requests.
- Attendees cannot perform organizer/admin operations.
- Pending organizers cannot manage events.
- Organizers cannot access other organizers' events.
- Deactivated accounts cannot perform protected actions.
- Users cannot change their own roles.

### Events and ticket types

- Reject invalid event dates.
- Do not expose draft events publicly.
- Enforce event ownership.
- Reject free/zero-priced tickets.
- Do not reduce ticket quantities below existing commitments.

### Registrations and payments

- Concurrent purchases cannot oversell inventory.
- Reservations expire according to the 10-minute rule.
- Duplicate checkout requests are safe.
- Invalid PayHere notifications cannot confirm payment.
- Duplicate valid notifications do not create duplicate tickets.
- Late notifications are reconciled safely.
- Failed payments never issue tickets.

### Tickets and check-in

- Attendees cannot view other users' tickets.
- Invalid/unpaid tickets cannot be checked in.
- Reject tickets for another event.
- Prevent duplicate check-ins.
- Manual check-in uses the same rules as QR scanning.

### Cancellation and frontend

- Cancelled events cannot accept purchases.
- Historical financial/registration records remain intact.
- Cancellation notifications are handled.
- Cancellation never triggers an automatic refund.
- Frontend loading, empty, error, and success states are tested.
- Verify lint, type-check, and production build for relevant frontend
  work.

## 17. Implementation roadmap

Follow this order unless repository inspection proves a phase is already
complete. Do not redo verified work merely to follow the list; first
inspect and report the current state.

1.  **Project setup:** separate Vite/React frontend and NestJS backend;
    configure React 19, Tailwind v4, Router, Axios, Clerk integration,
    environment handling, CORS, `/api`, and health endpoint; verify
    frontend checks and backend startup/health.
2.  **Database:** configure Supabase PostgreSQL and Prisma 7
    adapter/configuration; design schema, migrate, and verify
    connectivity/queries.
3.  **Clerk authentication:** frontend Clerk integration, protected
    routes, backend token verification, idempotent current-user sync,
    ngrok webhook verification, account deactivation tests.
4.  **Roles and organizer approval:** application roles/guards,
    organizer application, approval/rejection, backend authorization
    tests.
5.  **Categories and public discovery:** categories;
    paginated/searchable/filterable/sortable public events; home page
    with hero image; event detail/schedule pages;
    responsive/accessibility checks.
6.  **Organizer event management:** event CRUD and publication rules;
    Cloudinary; sessions; paid ticket types; ownership/edit restriction
    tests.
7.  **Registrations and inventory:** checkout preparation,
    concurrency-safe reservations, 10-minute expiry, duplicate-request
    protection, concurrency/expiry tests.
8.  **PayHere:** real checkout, verified server notifications, payment
    state transitions, duplicate/late notification handling, no
    browser-redirect-based confirmation.
9.  **Digital tickets and email:** tickets after verified payment,
    secure QR codes, attendee ticket pages, transactional email and
    retries; test duplicate webhook/email delivery.
10. **Check-in:** camera scanner, manual reference lookup, backend
    validation, atomic check-in, attendance views, invalid/duplicate
    tests.
11. **Dashboards and analytics:** attendee, organizer, and admin
    dashboards; event/platform analytics; role and aggregation tests.
12. **Final quality review:** end-to-end attendee purchase, organizer
    approval/event management, cancellation notification, admin
    workflows, security, responsive/accessibility review,
    lint/type-check/build, environment and webhook documentation.

## 18. Required workflow for every task

Use this sequence:

1.  **Clarify scope:** restate the task and success criteria. Do not
    code if the task/phase is unclear.
2.  **Inspect:** read relevant source files, tests, configuration,
    scripts, package versions, and documentation.
3.  **Plan:** identify affected files, behavior, risks, and tests. Ask
    before major architecture changes or when a business rule is
    undecided.
4.  **Implement:** make a focused, complete change using existing
    patterns.
5.  **Verify:** run focused tests first, then relevant
    lint/type/build/integration checks.
6.  **Review:** inspect the diff for unrelated edits, security gaps,
    regressions, and missing tests.
7.  **Report:** summarize files changed, behavior implemented, checks
    actually run, results, manual configuration still needed, and
    unresolved risks.
8.  **Pause:** wait for user confirmation before starting the next
    phase.

For implementation responses, provide complete updated file contents
when requested, exact paths, dependency installation commands,
environment variable names, setup steps, and a meaningful commit message
when appropriate.

## 19. Definition of done

Eventora is complete only when evidence demonstrates that:

- Attendees discover events and buy paid tickets through real PayHere.
- Inventory remains correct under concurrent purchases.
- Pending reservations expire after 10 minutes and late payments are
  reconciled safely.
- Only verified payment creates valid tickets.
- Attendees can access tickets and receive confirmation emails.
- Organizers require admin approval and can manage only their own
  events, sessions, and ticket types.
- Organizers can scan QR codes or manually enter references; duplicate
  check-ins are prevented.
- Event cancellation blocks new purchases, preserves history, and
  notifies attendees without automated refunds.
- Admins can manage users, organizer applications, categories, events,
  and platform analytics.
- Backend authorization protects sensitive operations.
- The frontend is responsive, accessible, visually polished, and
  consistently orange-themed.
- Frontend lint, TypeScript checks, and production build pass.
- Critical backend business rules have appropriate tests.
- Environment setup and local webhook testing are documented.

**Final principle:** Build a cohesive, secure, well-designed platform.
Prioritize reliable payment/ticketing behavior, clear architecture,
excellent UX, and maintainable code. Avoid unnecessary dependencies,
premature abstractions, generic AI-generated design patterns, simulated
integrations, and unverified completion claims.
