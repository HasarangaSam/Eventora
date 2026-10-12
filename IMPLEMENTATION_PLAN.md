# Eventora — Implementation Plan

## 1. Purpose

This document tracks the implementation and verification of Eventora, a full-stack event management and paid-ticketing platform.

The authoritative requirements are defined in `docs/project-spec.md`. Coding-agent workflow requirements are defined in `agents.md`.

This document records implementation progress. It does not replace the specification, and a listed task must not be considered complete merely because it appears here.

## 2. Progress Tracking Rules

### Status values

Use the following status values for phases and tasks:

- `NOT_STARTED`: Work has not begun.
- `IN_PROGRESS`: Implementation is underway.
- `BLOCKED`: Work cannot proceed because of an unresolved dependency or decision.
- `IMPLEMENTED`: Code has been written but verification is incomplete.
- `VERIFIED`: Acceptance criteria have been checked and supported by recorded evidence.

Do not mark a phase `VERIFIED` while any mandatory acceptance criterion remains unverified.

### Working rules

1. Inspect the repository before starting a phase.
2. Reuse existing working implementation instead of rebuilding it without justification.
3. Implement one focused phase at a time.
4. Run relevant checks and record their actual results.
5. Document required external configuration and manual setup.
6. Record unresolved defects, risks, and blockers.
7. Update this file after meaningful implementation and verification.
8. Request the user's confirmation before beginning the next phase.
9. Never mark a task verified based solely on code inspection when runtime or integration verification is required.
10. Keep all recorded status values consistent with the actual repository state.

## 3. Current Project Status

**Overall status:** IN_PROGRESS

The overall status must be updated as work progresses. It must reflect verified implementation rather than planned functionality.

| Item                         | Status      | Notes                                                           |
| ---------------------------- | ----------- | --------------------------------------------------------------- |
| Repository inspection        | IMPLEMENTED | Docs inspected; folder had no source files or Git metadata      |
| Project foundation           | IMPLEMENTED | Phase 1 committed; runtime checks remain                         |
| Database                     | VERIFIED    | Initial migration applied to configured Supabase DB; Prisma adapter query succeeded |
| Authentication               | IMPLEMENTED | Auth routes and signed webhook handling are implemented; real-session sync, DB account-status integration, and Dashboard delivery remain unverified |
| Roles and organizer approval | IMPLEMENTED | Migration applied; focused authorization tests pass; external admin provisioning and full flow verification remain |
| Public event discovery       | IMPLEMENTED | Public catalog APIs, category administration, discovery/detail UI, builds and unit checks; live HTTP and visual review remain |
| Organizer event management   | IMPLEMENTED | Phase 6 organizer APIs and dashboard; build and route checks passed |
| Registration and inventory   | IMPLEMENTED | Phase 7 APIs, atomic holds, expiry, cancellation release, and PostgreSQL concurrency verification |
| PayHere integration          | IMPLEMENTED | Hosted checkout UI/API, signed notification processing, late-payment handling; merchant sandbox verification awaits credentials |
| Digital tickets and email    | IMPLEMENTED | Phase 9 code, owner checks, Gmail SMTP authentication; no email sent |
| Check-in                     | NOT_STARTED | Phase 10                                                        |
| Dashboards and analytics     | NOT_STARTED | Phase 11                                                        |
| Final quality review         | NOT_STARTED | Phase 12                                                        |

These are initial tracking values, not claims about the existing repository. Update them after inspecting the implementation.

## 4. Phase 1 — Project Setup

**Status:** IMPLEMENTED

### Tasks

- [x] Inspect the existing repository; no Git metadata is present in this folder.
- [x] Inspect available Node.js and npm versions (Node v24.19.0, npm 12.0.2).
- [x] Inspect and create frontend and backend package manifests.
- [x] Confirm compatible React 19, TypeScript, Vite, Tailwind CSS v4, and NestJS versions by building and linting against the generated packages.
- [x] Configure the Vite/React frontend application foundation.
- [x] Configure React Router.
- [x] Configure Axios and the API base URL.
- [x] Add conditional `@clerk/react` provider and sign-in UI; requires a user-supplied publishable key.
- [x] Configure backend environment handling with `@nestjs/config`.
- [x] Configure the backend global API prefix as `/api`.
- [x] Configure CORS for the intended frontend origin.
- [x] Implement `GET /api/health`.
- [x] Add frontend and backend environment examples without real credentials.
- [x] Run configured frontend/backend lint and production build scripts.
- [x] Document frontend and backend startup instructions.
- [x] Document unresolved setup requirements.

### Acceptance criteria

- [ ] The frontend dev server starts successfully (not run).
- [ ] The backend server starts successfully (not run).
- [ ] The health endpoint returns the expected response at runtime (not run).
- [ ] CORS and API-prefix behavior are verified at runtime (not run).
- [x] Frontend lint, TypeScript build, and production build pass.
- [x] Backend lint and production build pass.
- [x] No credentials were added; `.env` files are ignored and examples are placeholders.
- [x] No prior source implementation existed in this folder to preserve.

### Verification record

- Commands executed:
- Results: `frontend/npm run lint`, `frontend/npm run build`, `backend/npm run lint`, and `backend/npm run build` all exited successfully. Runtime server and endpoint checks remain outstanding.
- Files changed: root `.gitignore` and `README.md`; `frontend/` Vite configuration, React entry/home page/styles, Axios client, environment example and package files; `backend/` Nest bootstrap/controller/configuration, environment example and package files.
- Manual configuration required: copy the two `.env.example` files to the local env file names described in `README.md`; the user has supplied a local Clerk publishable key, which is excluded from Git.
- Outstanding issues: Runtime server and health checks are still outstanding. Backend install reported 5 dependency advisories before the Prisma packages were added; current backend dependency install reports 9 (2 low, 1 moderate, 6 high); review with `npm audit` before deployment.

### Approval gate

Do not begin Phase 2 until Phase 1 has been reviewed and the user has confirmed proceeding.

## 5. Phase 2 — Database and Prisma

**Status:** VERIFIED

### Tasks

- [x] Inspect the current Prisma version and configuration; none existed before this phase.
- [x] Verify the official Prisma 7.x setup for PostgreSQL and `@prisma/adapter-pg`.
- [ ] Configure and verify Supabase PostgreSQL connectivity; DATABASE_URL is not configured locally.
- [x] Configure `prisma.config.ts` for Prisma 7.
- [x] Define the database schema and relationships.
- [x] Add enums, indexes, timestamps, deletion policies, and SQL check constraints.
- [x] Model users, organizer applications, categories, events, and event sessions.
- [x] Model ticket types, registrations, payments, payment attempts, and reservations.
- [x] Model individual tickets, check-ins, payment exceptions, and email delivery tracking.
- [x] Use precise `Decimal(12,2)` monetary representations.
- [x] Preserve historical records with restrictive foreign-key deletion policies.
- [x] Generate and review the initial migration SQL offline.
- [x] Configure Prisma client generation and the PostgreSQL adapter.
- [x] Implement the Prisma database service and module.
- [ ] Verify database connectivity and representative queries; waiting for a development Supabase URL.

### Acceptance criteria

- [x] Prisma client generation succeeds.
- [x] Migrations apply successfully to the intended development database.
- [x] Database relationships and constraints are modeled and schema validation succeeds.
- [x] Monetary fields use PostgreSQL Decimal, not floating-point types.
- [x] Historical records are protected by restrictive deletion policies.
- [x] Database queries work through the configured Prisma adapter.
- [x] No destructive changes were applied to valuable data.

### Verification record

- Commands executed in `backend/`: `npm run prisma:validate` (pass, Prisma 7.10.0); `npm run prisma:generate` (pass); `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script --output prisma/migrations/20261012000000_init/migration.sql` (pass, offline); `npm run build` (pass); `npm run lint` (pass); `npm run db:deploy` (pass); `npx prisma migrate status` (pass); Prisma adapter `SELECT 1 AS connected` (pass).
- Migration result: `20261012000000_init` successfully applied to the configured Supabase PostgreSQL database.
- Database connectivity result: Prisma PostgreSQL adapter returned `{ connected: 1 }`; Prisma reports the database schema is up to date.
- Schema decisions: Decimal money snapshots; hash-only QR tokens; separate reservation and payment-attempt records; counters for event and ticket-type inventory; database-clock expiry at exactly 10 minutes. Event timezone is explicit per event. Payment exceptions are recorded without defining review actions.
- Files changed: `backend/package.json` and lockfile; Prisma config/schema/migration; Nest Prisma module/service and app module; backend env example; `.gitignore`; `docs/DATABASE.md` and `docs/DEVELOPMENT.md`; root README and this plan.
- Outstanding issues: No Phase 2 database setup blockers remain. Business-feature database integration checks belong to their respective future phases and are not yet applicable.

### Approval gate

Review the schema and migration results before proceeding to Phase 3.

## 6. Phase 3 — Clerk Authentication

**Status:** IMPLEMENTED

### Tasks

- [x] Configure the Clerk application keys in local environment files.
- [x] Configure the frontend Clerk provider using `@clerk/react`.
- [x] Implement sign-in, sign-up, and session-aware UI.
- [ ] Configure Google login if enabled in Clerk.
- [x] Configure protected frontend routes.
- [x] Verify Clerk bearer tokens in NestJS using `@clerk/backend`.
- [x] Implement authenticated current-user synchronization.
- [x] Make synchronization idempotent using the unique Clerk user ID.
- [x] Implement the current-user endpoints.
- [x] Enforce database-backed active-account checks.
- [ ] Configure relevant Clerk webhooks in the Clerk Dashboard.
- [x] Verify webhook signatures.
- [x] Handle duplicate webhook deliveries safely through idempotent upserts/deactivation.
- [x] Document local webhook testing with ngrok.
- [x] Test unauthenticated/malformed-token rejection and the deactivated-account service rule.

### Acceptance criteria

- [x] Unauthenticated requests to protected endpoints are rejected.
- [ ] Valid Clerk tokens are verified by the backend.
- [x] Malformed bearer tokens are rejected.
- [x] Repeated synchronization uses an idempotent upsert keyed by the unique Clerk user ID.
- [ ] Database-backed account status is enforced.
- [ ] Deactivated users cannot perform protected actions.
- [ ] Webhook processing is signature-verified and duplicate-safe.

### Verification record

- Commands and checks: `npm install @clerk/backend` (installed `@clerk/backend` 3.23.2); frontend/backend `npm run build` and `npm run lint` (pass); `npm run test -- src/auth/auth.service.spec.ts` (3 tests passed); backend `npm run start:dev` (started with configured database); HTTP integration checks returned `200` for `/api/health`, `401` for missing and malformed bearer tokens, `200` for a locally signed non-mutating webhook event, and `400` for an invalid webhook signature.
- Clerk configuration verified: Frontend publishable key and backend Clerk keys are present in local environment files; values were not displayed.
- Webhook configuration verified: The configured signing secret successfully verified a locally signed event and rejected an invalid signature. The Clerk Dashboard endpoint and ngrok delivery were not verified.
- Authorization results: Missing and malformed bearer tokens are rejected. The unit test covers idempotent sync keyed by Clerk ID, preserving database role/status fields, and rejecting a deactivated record. A real Clerk-issued valid/expired token, current-user synchronization against a real Clerk identity, and database account-status integration remain unverified.
- Outstanding issues: Configure or verify the Clerk Dashboard webhook for `user.created`, `user.updated`, and `user.deleted`; exercise a real Clerk session through `/api/auth/me`; verify account-status behavior against the configured database before marking Phase 3 verified.

### Approval gate

Review authentication and user synchronization before Phase 4.

## 7. Phase 4 — Roles and Organizer Approval

**Status:** IMPLEMENTED

### Tasks

- [x] Implement `ATTENDEE`, `ORGANIZER`, and `ADMIN` role handling.
- [x] Implement backend role guards and reusable authorization utilities where justified.
- [x] Provision the initial administrator through a controlled setup process.
- [x] Prevent accidental administrator lockout.
- [x] Prevent privilege escalation.
- [x] Implement organizer applications.
- [x] Implement application status and decision handling.
- [x] Restrict organizer access to approved, active users (event ownership checks are implemented with organizer event routes in Phase 6).
- [x] Queue organizer decision notifications transactionally; email delivery awaits provider setup.
- [x] Test role and account-status authorization; event ownership checks are part of Phase 6.

### Acceptance criteria

- [x] New users receive the correct default role.
- [x] Users cannot change their own roles.
- [x] Attendees are rejected from administrator routes by backend role guards; organizer role authorization is separately enforced.
- [x] Pending or rejected applicants cannot use organizer-authorized routes.
- [x] Approved organizers pass the approval-aware role guard; concrete organizer operations are implemented in Phase 6.
- [x] Only administrators can make organizer approval decisions by backend route guard.
- [x] Deactivated accounts are rejected by the shared account guard.
- [x] Role and approval checks are enforced by the backend code.

### Verification record

- Tests executed: `npm.cmd run test` (4 test files, 11 tests passed, including the new account and role guard checks). The initial focused sandboxed attempt failed before collection with Windows temp `EPERM`; retry outside the restriction and the full suite passed.
- Build/lint/schema checks: Backend and frontend `npm.cmd run build` and `npm.cmd run lint` passed; `npm.cmd run prisma:validate` passed; `git diff --check` passed.
- Database: `npm.cmd run db:deploy` applied `20261012090000_pending_organizer_application_unique` to configured Supabase database.
- Role authorization results: Unit tests cover missing/deactivated accounts, attendee rejection from admin, admin access, pending organizer rejection, and approved organizer access. Initial-admin provisioning and a complete signed-in browser flow remain unverified.
- Organizer application results: Submission, reapplication after rejection, single-pending constraint, admin decisions, role promotion, and notification outbox are implemented. The migration is applied; no end-to-end application decision flow was exercised.
- Outstanding issues: Provision an initial admin using the documented command and manually exercise application submission/rejection/reapplication/approval in the UI. Actual Gmail delivery belongs to the email phase. Event ownership checks will be implemented and tested with organizer event routes in Phase 6.

### Approval gate

Review the role model and authorization tests before Phase 5.

## 8. Phase 5 — Categories and Public Event Discovery

**Status:** IMPLEMENTED

### Tasks

- [x] Implement category listing and administrative category management foundations.
- [x] Implement public event discovery.
- [x] Add server-side pagination.
- [x] Add relevant title/detail search.
- [x] Add category and date filters.
- [x] Add appropriate sorting.
- [x] Implement featured events.
- [x] Implement public event details.
- [x] Implement public event schedules.
- [x] Implement public ticket-type and availability views.
- [x] Build the homepage with a meaningful local hero image.
- [x] Implement responsive event listings and event details in the layout/CSS.
- [x] Apply the approved orange-themed visual system.
- [x] Add loading, empty, error, and success states.
- [x] Add automated checks for published-only queries, category history, pagination input, and ticket availability.

### Acceptance criteria

- [x] Public APIs expose only published events.
- [x] Draft events are treated as not found; public projections omit organizer identity and event capacity/inventory counters.
- [x] Pagination and filters are applied in database queries and pagination input is bounded.
- [x] Event details and schedules are limited to published events and ordered by event time.
- [x] Category references are protected from deletion while events reference them.
- [x] The homepage supports practical event discovery and pagination.
- [ ] Layouts have not been visually checked in a real desktop/mobile browser.
- [x] Frontend build and lint checks pass.

### Verification record

- API tests: Full backend `npm.cmd run test` passed (6 files, 19 tests); tests cover published-only event queries, non-disclosure projections, public sessions/ticket access, pagination validation, and category history safety.
- Frontend checks: `npm.cmd run build` and `npm.cmd run lint` passed. Backend `npm.cmd run build`, `npm.cmd run lint`, and `npm.cmd run prisma:validate` passed.
- Runtime/API review: Nest started successfully with catalog routes registered and Prisma initialized. Local HTTP probes to `127.0.0.1:3000` timed out even outside the sandbox; endpoint responses were not verified over HTTP.
- Responsive/accessibility review: Semantic labels, keyboard-operable controls, focus styles, reduced motion, and mobile CSS were reviewed in source; no browser visual or assistive-technology review was run.
- Outstanding issues: Verify API responses and responsive layouts in the browser when local socket access is available. Registration/checkout controls intentionally remain for later phases.

### Approval gate

Review public discovery and the frontend foundation before Phase 6.

## 9. Phase 6 — Organizer Event Management

**Status:** IMPLEMENTED — pending configured-service and browser verification

### Tasks

- [x] Implement organizer-owned event creation and editing.
- [x] Implement valid event publication transitions.
- [x] Implement event unpublishing and cancellation rules.
- [x] Prevent unauthorized access to other organizers' events.
- [x] Implement Cloudinary cover image uploads and deletion.
- [x] Validate image types and file sizes.
- [x] Implement informational event sessions.
- [x] Validate session times against event dates.
- [x] Implement paid ticket-type management.
- [x] Enforce prices greater than zero.
- [x] Validate currency, quantity, sales windows, and ticket activation.
- [x] Prevent quantity changes that violate existing commitments.
- [x] Restrict edits that could invalidate completed or pending transactions.
- [x] Preserve historical event data.

### Acceptance criteria

- [x] Organizers can manage only their own events.
- [x] Publication requirements are enforced.
- [x] Public APIs do not expose unpublished events.
- [x] Cover image operations are ownership-checked and safe.
- [x] Sessions are informational and cannot be booked separately.
- [x] Free ticket types are rejected.
- [x] Sold ticket types cannot be modified in ways that invalidate history.
- [x] Event and ticket-type business rules are tested.

### Verification record

- API/service tests: `npm.cmd run test -- --reporter=dot` passed (7 files, 25 tests); coverage includes ownership, free-ticket rejection, quantity commitments, publication requirements, schedule range, and image signature validation.
- Cloudinary configuration and tests: backend integration uses the Cloudinary Node SDK, checks required server-side configuration at use time, streams image buffers, and cleans up replacement assets on persistence failures. Live upload/delete was not exercised because Cloudinary credentials and a real asset were not provided for this verification.
- Ownership and business-rule tests: backend `npm.cmd run build`, `npm.cmd run lint`, and `npm.cmd run prisma:validate` passed; frontend `npm.cmd run build` and `npm.cmd run lint` passed. Nest started successfully with Prisma initialized and all organizer routes registered. No schema migration was required.
- Outstanding issues: Configure Cloudinary values in `backend/.env`; verify image upload/delete and organizer API responses against the configured services; visually inspect the organizer workspace in desktop and mobile browsers. Cancellation notifications are queued in the database outbox; provider delivery remains Phase 9.

### Approval gate

Review organizer management before Phase 7.

## 10. Phase 7 — Registrations and Inventory

**Status:** IMPLEMENTED

### Tasks

- [x] Implement authenticated registration requests.
- [x] Validate ticket types and positive, bounded integer quantities.
- [x] Calculate totals using trusted database ticket price and currency.
- [x] Enforce sales windows, published event state, future event dates, and event/ticket capacity.
- [x] Use guarded PostgreSQL updates and consistent row-lock ordering for concurrent inventory operations.
- [x] Reserve inventory and create pending registration/payment records atomically.
- [x] Set reservation expiry to exactly 10 minutes from its database-clock creation time.
- [x] Protect duplicate registration requests with a caller-provided idempotency key and unique constraint.
- [x] Implement a startup sweep, periodic expiry worker, and purchase-path expiry reconciliation.
- [x] Reconcile expiry during verified payment notification processing (implemented in Phase 8).
- [x] Handle races between expiry and verified successful payment (implemented in Phase 8).
- [x] Test concurrent purchases and inventory invariants against configured PostgreSQL.

### Acceptance criteria

- [x] Invalid purchases are rejected.
- [x] Concurrent purchases cannot oversell inventory.
- [x] Pending reservations expire according to the 10-minute rule.
- [x] Expired reservations release inventory safely.
- [x] Duplicate registration requests do not create duplicate commitments.
- [x] Registration and initiated payment-attempt records remain consistent.
- [x] Cancelled events cannot accept purchases; cancellation releases outstanding holds.
- [x] Reservation and concurrency tests pass.

### Verification record

- Transaction strategy: interactive Prisma transaction; event row then ticket-type row guarded updates; create registration, DB-clock reservation, and initiated payment attempt atomically.
- Concurrency tests: `npm run test:e2e -- --run` — 3 test files, 3 tests passed, including real PostgreSQL concurrent oversell, idempotency, cancellation release, and inventory counters.
- Expiry tests: same PostgreSQL integration test moves only its temporary hold past expiry, then verifies registration/payment/reservation status and counters after release.
- Unit tests: `npm run test -- --run` — 8 test files, 28 tests passed.
- Backend build/lint and frontend lint/build passed during this phase; see turn verification record.
- Outstanding issues: Digital ticket issuance and attendee ticket access remain Phase 9.

### Approval gate

Review the inventory strategy and concurrency tests before Phase 8.

## 11. Phase 8 — Real PayHere Integration

**Status:** IMPLEMENTED

### Tasks

- [x] Verify current official PayHere Checkout API, hash, notification, and status requirements.
- [ ] Configure live/sandbox merchant credentials in `backend/.env` (user setup required; no values are currently configured).
- [x] Implement backend-generated hosted checkout data and attendee checkout handoff.
- [x] Associate checkout attempts with trusted registration/payment records.
- [x] Implement the public PayHere notification endpoint for form-encoded callbacks.
- [x] Verify notifications using PayHere's official MD5 signature and constant-time comparison.
- [x] Validate merchant identity, order reference, amount, currency, status, and registration association.
- [x] Implement idempotent payment state transitions and preserve provider-reported amount/currency.
- [x] Prevent duplicate inventory changes; ticket issuance/idempotency belongs to Phase 9.
- [x] Serialize concurrent callbacks and handle out-of-order success from multiple attempts.
- [x] Reconcile late successful payments against current event/ticket capacity.
- [x] Record unfulfillable success, amount/currency mismatch, duplicate success, and chargeback exceptions for review.
- [x] Test invalid signatures, mismatched amounts, repeated/concurrent callbacks, late success, and checkout retry against PostgreSQL.
- [x] Document ngrok and PayHere local webhook setup in `docs/PAYMENTS.md`.

### Acceptance criteria

- [ ] Real PayHere checkout is configured and verified in the provider sandbox (awaiting merchant credentials and public notify URL).
- [x] Invalid signatures and payment mismatches are handled safely and recorded where the notification is verified.
- [x] Browser redirects cannot independently confirm payment.
- [x] Only verified success can confirm a registration; ticket issuance is deferred to Phase 9 and must consume confirmed registrations only.
- [x] Duplicate notifications do not duplicate payment/inventory state changes; ticket duplicate protection is Phase 9.
- [x] Late successful payments are preserved and reconciled against current capacity.
- [x] Unfulfillable successful payments are stored as payment exceptions for administrator review; no resolution action is invented.
- [x] No automated refunds are introduced.

### Verification record

- PayHere environment: sandbox settings are templated; no merchant credentials are configured and no external PayHere sandbox transaction was run.
- Notification verification tests: `npm run test:e2e -- --run` — real PostgreSQL flow with signed fixture callbacks, invalid signature, amount mismatch, chargeback, and successful transaction.
- Idempotency tests: same checkout request reuses its attempt; a failed attempt receives a new reference on retry; concurrent duplicate callbacks preserve one inventory commit.
- Late-payment tests: verified success after event cancellation is retained as succeeded with `LATE_PAYMENT_UNFULFILLED`; sold counters are unchanged.
- Manual merchant configuration: set `PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`, `PAYHERE_ENVIRONMENT`, `PAYHERE_NOTIFY_URL`, `PAYHERE_RETURN_URL`, and `PAYHERE_CANCEL_URL` in `backend/.env`; register the approved merchant domain and use ngrok for local callbacks.
- Outstanding issues: real sandbox verification awaits merchant credentials and a reachable ngrok URL. Digital ticket issuance and purchase email are Phase 9.

### Approval gate

Review payment correctness and exception handling before Phase 9.

## 12. Phase 9 — Digital Tickets and Transactional Email

**Status:** IMPLEMENTED

### Tasks

- [x] Implement individual ticket issuance only after verified payment and inventory fulfillment.
- [x] Generate unique, random ticket references.
- [x] Generate secure, unguessable QR tokens with a stable server-only HMAC key; store only token hashes.
- [x] Implement attendee ticket listings, QR details, and owner checks.
- [x] Enforce ticket ownership in backend queries.
- [x] Keep the Phase 8 payment and registration status views and link confirmed purchases to the ticket wallet.
- [x] Confirm Gmail SMTP with a Gmail App Password and TLS transport.
- [x] Implement purchase confirmation and attached QR ticket emails.
- [x] Implement organizer application decision emails.
- [x] Implement database-backed email delivery status tracking.
- [x] Add bounded exponential retry without duplicating business records.
- [x] Deliver existing cancellation outbox entries through the email worker.
- [x] Test repeated payment notifications, ticket issuance, ownership, and email retry state.

### Acceptance criteria

- [x] No ticket is issued before verified and fulfillable payment success; late unfulfillable success has no ticket or purchase email.
- [x] Each purchased ticket has a distinct random reference and HMAC QR token.
- [x] Private ticket information is protected by attendee ownership checks.
- [x] Purchase confirmation outbox rows are created only for confirmed, ticketed registrations.
- [x] Email failure is processed outside the payment/ticket transaction and cannot roll back payment or ticket records.
- [x] Payment retries and email outbox retries do not duplicate registrations, payments, or tickets.
- [x] Gmail SMTP configuration and provider setup are documented.

### Verification record

- Ticket issuance tests: `npm.cmd run test:e2e -- --run` — 3 test files / 3 tests passed against configured PostgreSQL; confirmed payment created one ticket and one outbox row, duplicate callbacks created no more, and an unfulfillable late success created neither.
- QR validation tests: backend unit suite covers stable HMAC derivation, hash verification, tampering rejection, and ticket-reference separation. PostgreSQL e2e verified owner access produces a PNG QR data URL and another attendee receives not found.
- Email provider configuration: Gmail SMTP authentication succeeded using `backend/.env`; TLS connection verified without sending a message. Local `.env` stays ignored and uncommitted.
- Retry and duplicate-delivery tests: unit suite verifies bounded retry scheduling and terminal failure after five attempts; transaction and payment integration tests verify outbox idempotency. No live message was sent during verification.
- Checks: backend `npm.cmd run build`, `npm.cmd run lint`, `npm.cmd test -- --run` (10 files / 31 tests), `npm.cmd run prisma:validate`, PostgreSQL `npm.cmd run test:e2e -- --run` (3 files / 3 tests), frontend `npm.cmd run lint`, and `npm.cmd run build` all passed. Vitest unit runs needed the approved elevated retry after Windows sandbox temp-file `EPERM` errors.
- Outstanding issues: Outbound Gmail message delivery has not been exercised to avoid sending an unsolicited message. SMTP verification confirmed credentials and connectivity. Gmail SMTP remains at-least-once if a process fails after acceptance and before the `SENT` update; this narrow duplicate window is documented.

### Approval gate

Review ticket security and email reliability before Phase 10.

## 13. Phase 10 — Check-In and Attendance

**Status:** NOT_STARTED

### Tasks

- [ ] Implement ticket validation.
- [ ] Implement browser camera QR scanning.
- [ ] Implement manual ticket-reference entry.
- [ ] Use the same backend validation rules for both methods.
- [ ] Enforce active, approved organizer authorization.
- [ ] Enforce event ownership.
- [ ] Verify ticket, registration, and payment state.
- [ ] Implement atomic, concurrency-safe check-in.
- [ ] Return clear validation outcomes.
- [ ] Implement event check-in history and attendance reporting.
- [ ] Handle camera permission failures and resource cleanup.
- [ ] Test duplicate and concurrent check-ins.

### Acceptance criteria

- [ ] Unauthorized organizers cannot validate or check in tickets.
- [ ] Tickets for another event are rejected.
- [ ] Invalid, unpaid, or already checked-in tickets are handled correctly.
- [ ] Two concurrent attempts cannot produce duplicate successful check-ins.
- [ ] QR scanning and manual entry enforce the same rules.
- [ ] Camera failures do not prevent manual check-in.
- [ ] Attendance reports use accurate backend records.

### Verification record

- Backend tests:
- Camera and manual-entry verification:
- Concurrency tests:
- Outstanding issues:

### Approval gate

Review check-in correctness before Phase 11.

## 14. Phase 11 — Dashboards and Analytics

**Status:** NOT_STARTED

### Tasks

- [ ] Implement the attendee dashboard.
- [ ] Show upcoming and past events, registrations, active tickets, and payment statuses.
- [ ] Implement the organizer dashboard.
- [ ] Show event counts, tickets sold, confirmed registrations, and gross confirmed sales.
- [ ] Add sales trends and payment-status breakdowns.
- [ ] Add attendance and check-in metrics.
- [ ] Implement event-specific analytics.
- [ ] Implement the administrator dashboard.
- [ ] Add user, organizer application, event, registration, payment, and attendance metrics.
- [ ] Restrict organizer analytics to the organizer's own events.
- [ ] Calculate financial metrics from verified payment records.
- [ ] Use efficient database aggregations and pagination.
- [ ] Add loading, empty, and error states.

### Acceptance criteria

- [ ] Each dashboard displays the correct role-specific information.
- [ ] Organizers cannot access other organizers' analytics.
- [ ] Financial figures use verified payments.
- [ ] Sales are labelled gross sales, not profit or organizer payout.
- [ ] Aggregations avoid unnecessarily loading all records into application memory.
- [ ] Metrics respect cancelled events and preserved historical records.
- [ ] Relevant authorization and aggregation tests pass.

### Verification record

- API and aggregation tests:
- Authorization tests:
- Frontend checks:
- Outstanding issues:

### Approval gate

Review dashboard accuracy and access restrictions before Phase 12.

## 15. Phase 12 — Final Quality Review

**Status:** NOT_STARTED

### Tasks

- [ ] Complete an end-to-end attendee purchase using the PayHere test environment.
- [ ] Verify organizer application and administrator approval.
- [ ] Verify organizer event creation, publication, and ticket configuration.
- [ ] Test concurrent purchase and inventory protection.
- [ ] Test reservation expiry and late-payment reconciliation.
- [ ] Verify ticket issuance and attendee ticket access.
- [ ] Verify email delivery and duplicate-notification handling.
- [ ] Verify QR scanning and manual check-in.
- [ ] Verify event cancellation and attendee notifications.
- [ ] Verify historical payment, registration, and ticket preservation.
- [ ] Review administrator workflows.
- [ ] Review authentication and authorization boundaries.
- [ ] Review environment variables and secret handling.
- [ ] Review rate limiting, uploads, webhooks, and safe logging.
- [ ] Review responsive behavior and accessibility.
- [ ] Run the configured frontend lint, type-check, and production build.
- [ ] Run relevant backend tests and production build.
- [ ] Review migrations and deployment configuration.
- [ ] Complete setup, payment, webhook, and development documentation.
- [ ] Review the Git diff and remove unintended changes.
- [ ] Record known limitations and outstanding risks.

### Acceptance criteria

- [ ] All mandatory requirements in `project_spec.md` have evidence of implementation and verification.
- [ ] Critical business invariants have appropriate tests.
- [ ] Required external integrations have been tested in the appropriate environments.
- [ ] Frontend and backend checks pass, or remaining failures are explicitly documented and resolved before claiming completion.
- [ ] Environment setup and local webhook testing are documented.
- [ ] No known critical security or payment-integrity defects remain.
- [ ] The definition of done in `project_spec.md` is supported by evidence.

### Verification record

- End-to-end test results:
- Frontend lint/type/build results:
- Backend test/build results:
- Security review:
- External integrations verified:
- Outstanding limitations:
- Final completion decision:

## 16. Cross-Phase Business Invariants

These requirements apply throughout development and must not be postponed until the final review.

### Authentication and authorization

- Clerk owns authentication; Eventora owns application authorization.
- Backend authorization is mandatory.
- Deactivated accounts cannot perform protected actions.
- Organizer approval is required for organizer-management operations.
- Ownership must be verified server-side.

### Payments and inventory

- Ticket prices must be greater than zero.
- Prices and totals come from trusted backend records.
- Inventory reservation must be concurrency-safe.
- Reservation expiry is 10 minutes.
- Payment notifications must be verified and processed idempotently.
- Only verified payment success permits ticket issuance.
- Late successful payments must not be discarded or falsely marked failed.

### History and cancellation

- Financial and registration history must be preserved.
- Event cancellation blocks new purchases.
- Event cancellation does not automatically refund payments.
- Ticket and check-in records must remain consistent.

### Ticket security

- Tickets must be individually identifiable.
- QR tokens must be secure and must not expose unnecessary private information.
- Ticket ownership and event authorization must be enforced.
- Check-in must be atomic and duplicate-safe.

## 17. Change and Decision Log

Record consequential decisions that are not already settled by `project_spec.md`.

| Date | Decision or issue                                                                   | Reason                                                                         | Status |
| ---- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------ |
| TBD  | Define administrative actions for late successful payments that cannot be fulfilled | Manual exception handling must be explicit; automated refunds are out of scope | OPEN   |

Do not reopen decisions already established by the authoritative specification without a concrete reason.

## 18. Final Definition of Done

Eventora is complete only when the definition of done in `project_spec.md` has been demonstrated through implementation and verification.

A phase checklist alone is not proof of completion. Evidence must come from source code, tests, configuration checks, database verification, and appropriate integration or end-to-end testing.

Maintain an honest distinction between planned, implemented, and verified functionality.

**Final principle:** Complete one phase at a time, verify it, report the actual results, and obtain the user's confirmation before proceeding.
