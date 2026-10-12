# AGENTS.md — Eventora Development Rules

## 1. Purpose and Authority

Eventora is a full-stack event management and paid-ticketing platform for attendees, organizers, and administrators.

Before making any changes, read `project_spec.md`. It is the authoritative source for product requirements, technology choices, business rules, security requirements, implementation phases, and acceptance criteria.

Follow this document alongside the repository's actual source code and configuration.

When requirements conflict:

1. Follow the confirmed requirements in `project_spec.md`.
2. Respect the actual installed dependencies, existing architecture, and verified implementation.
3. Do not silently change established business rules or architecture.
4. Identify genuine ambiguities and ask for clarification before making consequential decisions.

Do not assume that a feature exists because it appears in the specification or implementation plan.

## 2. Mandatory Workflow

Follow this workflow for every implementation task.

### Step 1: Clarify the task

- Restate the task and its expected outcome.
- Identify the relevant implementation phase.
- Ask questions when the scope or a consequential business rule is unclear.
- Do not begin implementation when the requested task is ambiguous.

### Step 2: Inspect the repository

Before modifying code, inspect the relevant:

- Source files and directory structure.
- `package.json` files and installed dependency versions.
- TypeScript, ESLint, Vite, NestJS, and Prisma configuration.
- Environment variable requirements.
- Existing tests, scripts, and documentation.
- Related Git changes when available.

Read the relevant code before proposing replacements. Preserve existing working functionality unless a concrete issue requires a change.

### Step 3: Plan the change

Before substantial changes, state:

- The intended implementation.
- Files to create, modify, or delete.
- Dependencies and environment variables required.
- Relevant security and business-integrity considerations.
- Tests and verification commands.

Keep the plan focused on the current task. Do not implement unrelated features or start the next phase without confirmation.

### Step 4: Implement

- Make the smallest complete change that satisfies the requirements.
- Follow the existing project structure and coding conventions.
- Use clear, modular, maintainable TypeScript.
- Prefer complete implementations over placeholders, pseudo-code, or unfinished stubs.
- Do not create speculative modules or unnecessary abstraction layers.
- Add meaningful comments for non-obvious business rules, concurrency decisions, security boundaries, and important engineering trade-offs.
- Avoid comments that simply repeat what the code already says.

When providing implementation instructions in chat, include exact file paths and complete, copy-paste-ready file contents when requested. Include required imports, types, dependencies, environment variables, and setup commands.

Clearly identify any files that must be created, updated, or removed.

### Step 5: Verify

Run the relevant checks using the scripts and configuration that actually exist in the repository.

Depending on the change, verify:

- Focused unit or integration tests.
- Backend and frontend linting.
- TypeScript checks.
- Production builds.
- Database migrations and connectivity.
- API behavior and authorization.
- Payment, inventory, ticketing, or check-in invariants.
- Relevant frontend loading, empty, error, and success states.

Do not invent scripts or claim that a check passed without running it successfully.

If a check cannot be run because credentials, external services, database access, or environment configuration are missing, explain the limitation and provide the next verification step.

### Step 6: Review

Review the final diff for:

- Unrelated changes.
- Missing validation and error handling.
- Authorization and ownership gaps.
- Race conditions and duplicate processing.
- Incorrect database transactions.
- Secret exposure or sensitive logging.
- Unused imports, variables, and dependencies.
- Accessibility and responsive-layout regressions.
- Missing or outdated documentation and tests.

Fix relevant issues before reporting completion.

### Step 7: Report and pause

At the end of each phase or implementation task, report:

1. What was implemented.
2. Files created, modified, or deleted.
3. Tests and checks actually executed.
4. Exact verification results.
5. Required manual configuration.
6. Known limitations and unresolved risks.
7. The next proposed step.

Wait for the user's confirmation before beginning the next implementation phase.

Never claim the application, feature, integration, or phase is complete unless the available evidence supports that claim.

## 3. Technology Stack Rules

Follow the stack defined in `project_spec.md`.

### Frontend

- React 19.
- TypeScript.
- Vite.
- Tailwind CSS v4.
- React Router.
- Axios.
- `@clerk/react`.
- Zod where appropriate.
- React built-in hooks and controlled forms.

Do not introduce Next.js, `@clerk/clerk-react`, React Query, TanStack Query, Zustand, Redux, React Hook Form, or unnecessary UI libraries.

Use feature-oriented modules, smaller reusable components, explicit types, accessible HTML, and clear API boundaries.

Inspect installed package versions before relying on a particular API.

### Backend

- Node.js and TypeScript.
- NestJS.
- Supabase-hosted PostgreSQL.
- Prisma ORM 7.x.
- `@prisma/adapter-pg` and `pg`.
- `@nestjs/config`.
- `@clerk/backend`.
- `class-validator` and `class-transformer`.
- Cloudinary SDK.
- NestJS file upload integration.
- A suitable QR-code generation library.

Use NestJS modules, controllers, services, DTOs, guards, and dependency injection appropriately.

Controllers handle HTTP concerns. Services enforce business rules. Prisma handles database access.

Avoid unnecessary repositories, factories, duplicate abstractions, and oversized services.

### Compatibility

Before installing, upgrading, or replacing dependencies:

1. Inspect the installed versions.
2. Check official documentation and compatibility.
3. Confirm the change is necessary.
4. Avoid unrelated dependency upgrades.

Follow Prisma 7 configuration and migration conventions. Do not copy outdated Prisma 5 or 6 examples into the project.

## 4. Architecture and Code Quality

- Keep frontend and backend responsibilities separate.
- Organize code by feature and responsibility.
- Reuse established project patterns where appropriate.
- Keep business logic out of controllers and presentation components.
- Validate untrusted input at the backend boundary.
- Use explicit TypeScript types and avoid unjustified `any`.
- Use async/await and handle asynchronous failures deliberately.
- Keep API responses and error handling consistent.
- Use database transactions for operations that must succeed or fail together.
- Prefer database constraints and atomic operations for business invariants.
- Avoid duplicated routes and competing sources of truth.
- Do not suppress lint or type errors to make checks pass.
- Do not use `@ts-ignore` or careless assertions to conceal defects.
- Avoid unnecessary effects, memoization, global state, and dependencies.
- Clean up timers, subscriptions, event listeners, and camera resources.

Use the existing repository's naming conventions and file structure unless a justified improvement is approved.

## 5. Authentication and Authorization

Clerk is responsible for authentication and identity. Eventora's PostgreSQL database is responsible for application roles, account activation, and organizer approval.

The backend must:

- Verify Clerk bearer tokens using `@clerk/backend`.
- Synchronize users idempotently.
- Enforce unique Clerk identity mapping.
- Resolve roles and account status from trusted database records.
- Block deactivated accounts.
- Require administrator approval before organizer management is permitted.
- Verify event ownership in the backend.
- Restrict administrative operations to authorized administrators.
- Prevent users from changing their own roles or elevating privileges.
- Validate Clerk webhook signatures and tolerate duplicate webhook delivery.

Never trust frontend-supplied roles, prices, totals, registration owners, organizer IDs, or ownership claims.

Frontend route protection is for user experience only. Backend authorization is the security boundary.

Do not implement manual authentication, custom JWT issuance, refresh-token handling, or Passport authentication.

## 6. Database and Historical Integrity

Use Supabase PostgreSQL with Prisma 7.x and the PostgreSQL adapter.

- Use appropriate foreign keys, indexes, unique constraints, enums, and deletion policies.
- Preserve historical registrations, payments, tickets, and referenced categories.
- Prefer archiving or disabling records when deletion would damage history.
- Use precise monetary representations, never floating-point arithmetic for financial calculations.
- Validate relationships and ownership on the backend.
- Use database transactions for related changes.
- Use atomic database operations or appropriate locking for concurrency-sensitive operations.
- Never reduce inventory below existing commitments.
- Never hard-delete financial records to simplify application behavior.

Review migration impact before applying schema changes. Never use destructive database commands against valuable data without explicit authorization and a verified recovery plan.

## 7. Payment and Inventory Integrity

PayHere must be integrated as a real payment provider. Simulated payments, fake success buttons, and unverified payment confirmation are prohibited.

The backend must:

- Calculate prices and totals from trusted database records.
- Reject free or zero-priced ticket types.
- Enforce ticket sales windows, quantity limits, event capacity, and available inventory.
- Reserve inventory using a concurrency-safe database strategy.
- Set reservation expiry to 10 minutes after creation.
- Protect duplicate checkout requests.
- Verify PayHere server notifications using the current official requirements.
- Validate payment references, registration association, amount, currency, status, and signature/hash as applicable.
- Process repeated and concurrent notifications idempotently.
- Issue tickets only after verified payment success.
- Prevent duplicate ticket issuance, inventory adjustments, and confirmation emails.
- Reconcile reservation expiry and late payment notifications safely.
- Preserve successful payment records even when inventory cannot be fulfilled.
- Record unresolved payment exceptions for explicit administrative review.

A successful browser redirect is never proof of payment.

Do not implement automated refunds, attendee cancellation, or refund-request functionality unless the authoritative specification is explicitly revised.

Do not invent administrative payment-exception actions when their business rules are undecided. Ask for clarification.

## 8. Ticketing and Check-In

Each ticket must have a unique reference and a secure, unguessable QR token.

- Do not expose sensitive attendee information or unnecessary internal database IDs in QR payloads.
- Verify ticket ownership before returning private ticket details.
- Never treat a QR image as proof of validity or payment.
- Require confirmed registration and payment before ticket issuance.
- Verify organizer approval, active status, event ownership, ticket validity, and payment state during check-in.
- Make QR scanning and manual ticket-reference entry use the same backend validation rules.
- Perform check-in atomically to prevent concurrent duplicate check-ins.
- Return clear outcomes without exposing unnecessary private information.
- Provide manual entry when camera permissions or camera hardware are unavailable.

Preserve ticket and check-in history.

## 9. Events, Images, and Cancellation

### Event management

- Expose only published events through public discovery endpoints.
- Enforce organizer ownership for event management.
- Validate event dates, publication requirements, sessions, ticket types, and sales windows.
- Restrict changes that could invalidate existing registrations or payments.
- Prevent new purchases for cancelled events.
- Preserve historical event records.

### Cloudinary

- Keep credentials on the backend.
- Validate file types and file sizes.
- Verify event ownership before replacing or deleting cover images.
- Store the asset URL and public ID in PostgreSQL.
- Replace or delete assets safely and prevent orphaned uploads.

### Cancellation

When an authorized organizer or administrator cancels an event:

- Mark the event as cancelled.
- Preserve registrations, payments, and tickets.
- Block new purchases.
- Notify registered attendees.
- Display the cancellation status appropriately.
- Preserve historical analytics.
- Do not automatically refund payments.

## 10. Email and External Services

Use the transactional email provider agreed for Eventora.

The project brief mentions Gmail. Verify the intended delivery method and its supported configuration before implementation. Do not silently substitute another provider.

Required messages include:

- Verified purchase confirmation and digital ticket details.
- Organizer application decisions.
- Event cancellation notifications.

Track email delivery failures where appropriate and implement retry behavior without duplicating payments, registrations, or tickets.

Use a database-backed outbox if the reliability requirements justify it.

Keep service credentials in environment variables. Document local setup, webhook URLs, and required configuration without committing secrets.

Use ngrok for local webhook testing where necessary. Verify current official integration documentation before implementing PayHere, Clerk, Cloudinary, or email delivery.

## 11. Frontend and User Experience

Follow the orange-themed design system in `project_spec.md`.

- Build a distinctive event-discovery and ticketing experience.
- Prioritize useful event discovery and navigation.
- Include a meaningful home-page hero image.
- Use responsive layouts, consistent typography, and sensible spacing.
- Use real Cloudinary event images and appropriate fallbacks.
- Avoid generic SaaS templates, fake statistics, excessive gradients, decorative blobs, and unnecessary animation.
- Use semantic HTML, labels, keyboard navigation, visible focus, and accessible contrast.
- Provide loading, empty, error, success, disabled, and validation states.
- Confirm destructive actions.
- Handle asynchronous errors and stale responses.
- Clean up camera streams and other browser resources.
- Keep attendee, organizer, and administrator navigation appropriate to each role.

Do not introduce unnecessary global state or form libraries.

## 12. Testing Requirements

Test business invariants, not only successful HTTP responses.

Prioritize tests for:

- Authentication, role authorization, account deactivation, and organizer approval.
- Event ownership and public visibility.
- Ticket price validation and inventory limits.
- Concurrent reservations and reservation expiry.
- Duplicate checkout requests and PayHere notifications.
- Invalid signatures, payment mismatches, and late successful payments.
- Ticket issuance only after verified payment.
- Ticket ownership and QR-token validation.
- Atomic check-in and duplicate scans.
- Cancellation without data loss or automatic refunds.
- Email retry behavior and duplicate delivery.
- Frontend loading, empty, error, and success states.

Use the testing framework and scripts already configured in the repository.

Run relevant tests first, then the applicable lint, type-check, build, and integration checks.

Report the exact commands and results. Do not describe unexecuted tests as passing.

## 13. Environment and Secrets

- Inspect existing environment conventions before adding variables.
- Maintain accurate `.env.example` files.
- Never commit `.env`, real API keys, database passwords, merchant secrets, or production credentials.
- Never expose backend secrets through frontend environment variables.
- Validate required environment variables during application startup where appropriate.
- Use safe, descriptive errors for missing configuration.
- Redact credentials and sensitive personal information from logs.
- Do not invent credentials or claim an external service is configured without verification.

Keep frontend and backend environment variables separated according to their security requirements.

## 14. Documentation and Progress Tracking

Maintain documentation as the implementation evolves.

- `project_spec.md`: authoritative product and business requirements.
- `README.md`: overview, prerequisites, installation, development, and major links.
- `IMPLEMENTATION_PLAN.md`: phase status, acceptance criteria, test results, and outstanding tasks.
- `ARCHITECTURE.md`: actual architecture and important design decisions.
- `docs/DATABASE.md`: database relationships, constraints, and migration considerations.
- `docs/SECURITY.md`: authorization and security controls.
- `docs/PAYMENTS.md`: PayHere integration, inventory reservations, expiry, and exception handling.
- `docs/EMAIL.md`: provider configuration, delivery tracking, and retries.
- `docs/DEVELOPMENT.md`: local environment and development workflows.

Create or update documents when they become relevant. Do not fabricate completed features or document unimplemented behavior as operational.

Keep `IMPLEMENTATION_PLAN.md` consistent with verified repository state. Record blockers and manual configuration requirements explicitly.

## 15. Git and Change Management

- Make focused, reviewable changes.
- Avoid unrelated formatting changes and unnecessary file rewrites.
- Never remove user work or discard existing changes without authorization.
- Inspect Git status before substantial edits when Git is available.
- Use meaningful commit messages that describe the change.
- Do not commit secrets, generated build output, or local dependency directories.
- Explain potentially destructive commands before executing them.

A successful command does not automatically mean the implementation is correct. Review the resulting diff and relevant application behavior.

## 16. Completion Criteria

A task is complete only when:

1. The requested behavior is implemented.
2. Relevant business rules and security checks are enforced.
3. Appropriate tests or verification steps have been run.
4. Existing functionality has not been unintentionally broken.
5. Documentation and progress tracking are updated where necessary.
6. Required manual configuration and unresolved risks are reported.
7. The user receives a concise, evidence-based summary.

A phase is complete only when its acceptance criteria are supported by actual verification.

Do not claim that Eventora is fully complete until the definition of done in `project_spec.md` has been demonstrated.

## Final Rule

Build Eventora incrementally as a cohesive, secure, maintainable, and usable application.

Prioritize payment integrity, inventory correctness, authorization, historical data preservation, and reliable ticketing over superficial progress.

Inspect first. Plan before substantial changes. Implement carefully. Verify honestly. Report clearly. Wait for confirmation before moving to the next phase.
