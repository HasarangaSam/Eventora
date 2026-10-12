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
| Project foundation           | IMPLEMENTED | Phase 1 scaffold and code are in place; runtime checks remain    |
| Database                     | NOT_STARTED | Phase 2                                                         |
| Authentication               | NOT_STARTED | Phase 3                                                         |
| Roles and organizer approval | NOT_STARTED | Phase 4                                                         |
| Public event discovery       | NOT_STARTED | Phase 5                                                         |
| Organizer event management   | NOT_STARTED | Phase 6                                                         |
| Registration and inventory   | NOT_STARTED | Phase 7                                                         |
| PayHere integration          | NOT_STARTED | Phase 8                                                         |
| Digital tickets and email    | NOT_STARTED | Phase 9                                                         |
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
- [ ] Confirm compatible React 19, TypeScript, Vite, Tailwind CSS v4, and NestJS versions.
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
- [ ] Document any unresolved setup requirements.

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
- Manual configuration required: copy the two `.env.example` files to the local env file names described in `README.md`; provide a Clerk publishable key to enable authentication UI.
- Outstanding issues: Add a Clerk publishable key to `frontend/.env.local` to enable sign-in. Backend install reported 5 dependency advisories (2 low, 1 moderate, 2 high); review with `npm audit` before deployment.

### Approval gate

Do not begin Phase 2 until Phase 1 has been reviewed and the user has confirmed proceeding.

## 5. Phase 2 — Database and Prisma

**Status:** NOT_STARTED

### Tasks

- [ ] Inspect the current Prisma version and configuration.
- [ ] Verify the official Prisma 7.x setup for PostgreSQL and `@prisma/adapter-pg`.
- [ ] Configure Supabase PostgreSQL connectivity.
- [ ] Configure `prisma.config.ts` according to the installed Prisma version.
- [ ] Define the database schema and relationships.
- [ ] Add enums, constraints, indexes, timestamps, and appropriate deletion policies.
- [ ] Model users, organizer applications, categories, events, and event sessions.
- [ ] Model ticket types, registrations, payments, payment attempts, and reservations.
- [ ] Model individual tickets, check-ins, and email delivery tracking where appropriate.
- [ ] Use precise monetary representations.
- [ ] Preserve historical records.
- [ ] Create and review the initial migration.
- [ ] Configure Prisma client generation and the PostgreSQL adapter.
- [ ] Implement the database service and module.
- [ ] Verify database connectivity and representative queries.

### Acceptance criteria

- [ ] Prisma client generation succeeds.
- [ ] Migrations apply successfully to the intended development database.
- [ ] Database relationships and constraints match the specification.
- [ ] Monetary fields do not use floating-point types.
- [ ] Historical records are protected by appropriate deletion policies.
- [ ] Database queries work through the configured Prisma adapter.
- [ ] No destructive changes are applied to valuable data without authorization.

### Verification record

- Commands executed:
- Migration result:
- Database connectivity result:
- Schema decisions:
- Files changed:
- Outstanding issues:

### Approval gate

Review the schema and migration results before proceeding to Phase 3.

## 6. Phase 3 — Clerk Authentication

**Status:** NOT_STARTED

### Tasks

- [ ] Configure the Clerk application.
- [ ] Configure the frontend Clerk provider using `@clerk/react`.
- [ ] Implement sign-in, sign-up, and session-aware UI.
- [ ] Configure Google login if enabled in Clerk.
- [ ] Configure protected frontend routes.
- [ ] Verify Clerk bearer tokens in NestJS using `@clerk/backend`.
- [ ] Implement authenticated current-user synchronization.
- [ ] Make synchronization idempotent using the unique Clerk user ID.
- [ ] Implement the current-user endpoints.
- [ ] Enforce database-backed active-account checks.
- [ ] Configure relevant Clerk webhooks.
- [ ] Verify webhook signatures.
- [ ] Handle duplicate webhook deliveries safely.
- [ ] Document local webhook testing with ngrok.
- [ ] Test authentication failures and account deactivation.

### Acceptance criteria

- [ ] Unauthenticated requests to protected endpoints are rejected.
- [ ] Valid Clerk tokens are verified by the backend.
- [ ] Invalid or expired tokens are rejected.
- [ ] Repeated user synchronization does not create duplicate users.
- [ ] Database-backed account status is enforced.
- [ ] Deactivated users cannot perform protected actions.
- [ ] Webhook processing is signature-verified and duplicate-safe.

### Verification record

- Commands and tests:
- Clerk configuration verified:
- Webhook configuration verified:
- Authorization results:
- Outstanding issues:

### Approval gate

Review authentication and user synchronization before Phase 4.

## 7. Phase 4 — Roles and Organizer Approval

**Status:** NOT_STARTED

### Tasks

- [ ] Implement `ATTENDEE`, `ORGANIZER`, and `ADMIN` role handling.
- [ ] Implement backend role guards and reusable authorization utilities where justified.
- [ ] Provision the initial administrator through a controlled setup process.
- [ ] Prevent accidental administrator lockout.
- [ ] Prevent privilege escalation.
- [ ] Implement organizer applications.
- [ ] Implement application status and decision handling.
- [ ] Restrict event management to approved, active organizers.
- [ ] Implement organizer decision notifications.
- [ ] Test role and ownership authorization.

### Acceptance criteria

- [ ] New users receive the correct default role.
- [ ] Users cannot change their own roles.
- [ ] Attendees cannot access organizer or administrator operations.
- [ ] Pending or rejected applicants cannot manage events.
- [ ] Approved organizers can access permitted organizer operations.
- [ ] Only administrators can make organizer approval decisions.
- [ ] Deactivated accounts remain blocked.
- [ ] Role and approval checks are enforced by the backend.

### Verification record

- Tests executed:
- Role authorization results:
- Organizer application results:
- Outstanding issues:

### Approval gate

Review the role model and authorization tests before Phase 5.

## 8. Phase 5 — Categories and Public Event Discovery

**Status:** NOT_STARTED

### Tasks

- [ ] Implement category listing and administrative category management foundations.
- [ ] Implement public event discovery.
- [ ] Add server-side pagination.
- [ ] Add relevant title/detail search.
- [ ] Add category and date filters.
- [ ] Add appropriate sorting.
- [ ] Implement featured events.
- [ ] Implement public event details.
- [ ] Implement public event schedules.
- [ ] Implement public ticket-type and availability views.
- [ ] Build the homepage with a meaningful hero image.
- [ ] Implement responsive event listings and event details.
- [ ] Apply the approved orange-themed visual system.
- [ ] Add loading, empty, error, and success states.
- [ ] Verify accessibility and public data restrictions.

### Acceptance criteria

- [ ] Public APIs expose only published events.
- [ ] Draft and private organizer information is not leaked.
- [ ] Pagination and filters work correctly.
- [ ] Event details and schedules are accurate.
- [ ] Category references are handled safely.
- [ ] The homepage supports practical event discovery.
- [ ] Layouts work on desktop and mobile.
- [ ] Relevant frontend checks pass.

### Verification record

- API tests:
- Frontend checks:
- Responsive/accessibility review:
- Outstanding issues:

### Approval gate

Review public discovery and the frontend foundation before Phase 6.

## 9. Phase 6 — Organizer Event Management

**Status:** NOT_STARTED

### Tasks

- [ ] Implement organizer-owned event creation and editing.
- [ ] Implement valid event publication transitions.
- [ ] Implement event unpublishing and cancellation rules.
- [ ] Prevent unauthorized access to other organizers' events.
- [ ] Implement Cloudinary cover image uploads and deletion.
- [ ] Validate image types and file sizes.
- [ ] Implement informational event sessions.
- [ ] Validate session times against event dates.
- [ ] Implement paid ticket-type management.
- [ ] Enforce prices greater than zero.
- [ ] Validate currency, quantity, sales windows, and ticket activation.
- [ ] Prevent quantity changes that violate existing commitments.
- [ ] Restrict edits that could invalidate completed or pending transactions.
- [ ] Preserve historical event data.

### Acceptance criteria

- [ ] Organizers can manage only their own events.
- [ ] Publication requirements are enforced.
- [ ] Public APIs do not expose unpublished events.
- [ ] Cover image operations are ownership-checked and safe.
- [ ] Sessions are informational and cannot be booked separately.
- [ ] Free ticket types are rejected.
- [ ] Sold ticket types cannot be modified in ways that invalidate history.
- [ ] Event and ticket-type business rules are tested.

### Verification record

- API tests:
- Cloudinary configuration and tests:
- Ownership and business-rule tests:
- Outstanding issues:

### Approval gate

Review organizer management before Phase 7.

## 10. Phase 7 — Registrations and Inventory

**Status:** NOT_STARTED

### Tasks

- [ ] Implement authenticated registration requests.
- [ ] Validate ticket types and purchase quantities.
- [ ] Calculate totals using trusted database records.
- [ ] Enforce sales windows and event capacity.
- [ ] Design a concurrency-safe inventory reservation strategy.
- [ ] Reserve inventory and create pending registration/payment records atomically where required.
- [ ] Set reservation expiry to 10 minutes after creation.
- [ ] Protect duplicate checkout requests.
- [ ] Implement reliable server-side expiry processing.
- [ ] Reconcile expiry during payment notification processing.
- [ ] Handle races between expiry and successful payment.
- [ ] Test concurrent purchases and inventory invariants.

### Acceptance criteria

- [ ] Invalid purchases are rejected.
- [ ] Concurrent purchases cannot oversell inventory.
- [ ] Pending reservations expire according to the 10-minute rule.
- [ ] Expired reservations release inventory safely.
- [ ] Duplicate checkout requests do not create duplicate commitments.
- [ ] Registration and payment records remain consistent.
- [ ] Cancelled events cannot accept purchases.
- [ ] Reservation and concurrency tests pass.

### Verification record

- Transaction strategy:
- Concurrency tests:
- Expiry tests:
- Outstanding issues:

### Approval gate

Review the inventory strategy and concurrency tests before Phase 8.

## 11. Phase 8 — Real PayHere Integration

**Status:** NOT_STARTED

### Tasks

- [ ] Verify current official PayHere integration requirements.
- [ ] Configure backend-only merchant credentials.
- [ ] Implement backend-generated checkout data.
- [ ] Associate checkout attempts with trusted registration/payment records.
- [ ] Implement the PayHere notification endpoint.
- [ ] Verify notifications using the official signature/hash requirements.
- [ ] Validate merchant identity, payment reference, amount, currency, status, and registration association.
- [ ] Implement idempotent payment state transitions.
- [ ] Prevent duplicate ticket issuance and repeated inventory changes.
- [ ] Handle concurrent and out-of-order notifications.
- [ ] Reconcile late successful payments.
- [ ] Record payment exceptions for administrative review.
- [ ] Test invalid notifications and mismatched amounts.
- [ ] Document local webhook testing through ngrok.

### Acceptance criteria

- [ ] Real PayHere checkout is configured and verified in the appropriate test environment.
- [ ] Invalid signatures and payment mismatches are rejected safely.
- [ ] Browser redirects cannot independently confirm payment.
- [ ] Only verified success can trigger registration confirmation and ticket issuance.
- [ ] Duplicate notifications do not duplicate financial or ticketing operations.
- [ ] Late successful payments are preserved and reconciled.
- [ ] Unfulfillable successful payments are recorded for explicit administrative review.
- [ ] No automated refunds are introduced.

### Verification record

- PayHere environment:
- Notification verification tests:
- Idempotency tests:
- Late-payment tests:
- Manual merchant configuration:
- Outstanding issues:

### Approval gate

Review payment correctness and exception handling before Phase 9.

## 12. Phase 9 — Digital Tickets and Transactional Email

**Status:** NOT_STARTED

### Tasks

- [ ] Implement individual ticket issuance after verified payment.
- [ ] Generate unique ticket references.
- [ ] Generate secure, unguessable QR tokens.
- [ ] Implement attendee ticket listings and ticket details.
- [ ] Enforce ticket ownership.
- [ ] Implement payment and registration status views.
- [ ] Confirm the intended transactional email provider and delivery method.
- [ ] Implement purchase confirmation and ticket delivery emails.
- [ ] Implement organizer application decision emails.
- [ ] Implement email delivery status tracking.
- [ ] Add appropriate retries without duplicating business operations.
- [ ] Ensure cancellation notification support is available.
- [ ] Test repeated payment notifications and email delivery attempts.

### Acceptance criteria

- [ ] No ticket is issued before verified payment success.
- [ ] Each purchased ticket has a distinct reference and QR token.
- [ ] Private ticket information is protected.
- [ ] Confirmation emails correspond to verified purchases.
- [ ] Email failure does not corrupt payment or ticket records.
- [ ] Retries do not duplicate registrations, payments, or tickets.
- [ ] The configured email provider and setup are documented.

### Verification record

- Ticket issuance tests:
- QR validation tests:
- Email provider configuration:
- Retry and duplicate-delivery tests:
- Outstanding issues:

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
