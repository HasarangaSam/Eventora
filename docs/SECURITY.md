# Security Notes

## Authentication and identity

Clerk authenticates users. Eventora stores the unique Clerk user ID and owns the application role and account status in PostgreSQL. Never accept a user ID, role, or account status supplied by the browser as authorization evidence.

The backend's `ClerkAuthGuard` accepts a session bearer token only, verifies it through `@clerk/backend`, and checks the token's authorized party against `FRONTEND_ORIGIN`. `GET /api/auth/me` synchronizes the authenticated Clerk profile using the verified token subject and returns the corresponding Eventora record. Profile synchronization uses an upsert keyed by the unique `clerkUserId`; its update fields deliberately exclude role and status. Deactivated accounts receive `403 Forbidden` from the current-user endpoint.

Frontend route protection and Clerk components improve the user experience. They do not replace backend token verification. Protected business routes use `ClerkAuthGuard`, then `AccountGuard` to resolve the database user and reject deactivated accounts, then `RolesGuard` to check the database role. Organizer access also requires an approved organizer application. Browser-supplied roles, account IDs, and status values are never used as authorization evidence.

## Roles and organizer approval

New database users default to `ATTENDEE`; Clerk synchronization never changes `role` or `status`. There is no self-service role update endpoint. Admin role/status routes are protected by the database-backed admin role and serialize changes with a PostgreSQL advisory transaction lock. They reject changes that would leave no active administrator. An admin cannot demote their own role.

The initial administrator is provisioned out of band with `npm run admin:provision -- <clerk-user-id>` from `backend/`. The command only works when no active administrator exists and targets an already synchronized, active account. It does not accept a role from a browser request.

An attendee may keep prior rejected application records and submit a new application; only one pending application per applicant is allowed. A partial unique index in migration `20261012090000_pending_organizer_application_unique` enforces this under concurrent requests. Approval, reviewer attribution, role promotion, and an idempotent decision-email outbox row are committed in one transaction. The application record remains the source of organizer approval, and the queued email is not evidence of a decision. Delivery is pending email-provider setup.

## Clerk webhook

`POST /api/auth/webhooks/clerk` is public because Clerk sends server-to-server requests without a user session. Nest preserves the raw request body, and Clerk's `verifyWebhook` helper validates its signature with `CLERK_WEBHOOK_SIGNING_SECRET`. Invalid signatures are rejected. Repeated create/update deliveries use a unique-ID upsert; repeated delete deliveries use an idempotent status update. `user.deleted` deactivates the matching Eventora record rather than deleting financial or registration history.

Subscribe the Clerk endpoint only to `user.created`, `user.updated`, and `user.deleted`. Use ngrok for local webhook delivery as described in `DEVELOPMENT.md`. Do not log webhook payloads, session tokens, secret keys, or full database connection strings.

## Required configuration

- `VITE_CLERK_PUBLISHABLE_KEY` is public and belongs in `frontend/.env.local`.
- `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `CLERK_WEBHOOK_SIGNING_SECRET` belong in `backend/.env`; only the secret and webhook signing secret are confidential.
- `FRONTEND_ORIGIN` must be the exact frontend origin allowed to issue Clerk session tokens.
- Require Clerk sign-ups to provide a primary email address; Eventora's user schema requires one.

The organizer decision outbox records pending notifications transactionally; the Gmail worker delivers them with bounded retries and safe error codes.

Organizer event APIs require the approved-organizer role guard and additionally filter every event and child-record operation by both the requested event ID and the authenticated database organizer ID. Request bodies accept only documented fields; organizers cannot submit status, ownership, slug, or featured flags. Draft-to-published transitions require complete details, an active category, future dates, and an active paid ticket type with remaining inventory. Unpublishing is blocked after registrations or reservations exist. Cancellation is transactional with idempotent outbox entries for confirmed attendees and does not alter payment, ticket, or registration history.

Ticket prices are validated as positive decimal strings (at most two fractional digits); sales windows, currency, quantities, and event capacity are checked server-side. Ticket quantities cannot fall below reserved and sold commitments; price, currency, name, and sales-window terms cannot change after commitments. Referenced ticket types are deactivated rather than deleted. Sessions must lie within the event schedule and are not independently bookable. Events with registration, reservation, ticket, or check-in history cannot be deleted.

Cloudinary credentials remain in backend configuration. The upload route limits request size, allows JPEG/PNG/WebP MIME types, then verifies file signatures before streaming bytes to Cloudinary. The database is updated only after a successful upload; failed DB updates trigger cleanup of the newly uploaded asset. Replacing/removing a cover retains the prior database reference if Cloudinary deletion fails.

Registration creation requires a verified Clerk session and active database account. The backend accepts no attendee, price, currency, total, role, or ownership values from the request body. It validates the idempotency header and positive integer quantity, then calculates the amount from the ticket record inside the same transaction that reserves inventory and writes the pending registration and payment attempt. Registration reads are scoped to the authenticated attendee. Conditional PostgreSQL updates enforce published event state, future event dates, ticket sales windows, paid ticket prices, event capacity, and ticket-type availability. Reservation expiry and event cancellation serialize with purchase on event/ticket rows and release only still-held reservations.

PayHere checkout form hashes and notifications are generated/verified only on the backend. Notifications must be form-encoded and pass the official `md5sig` check before state changes. Eventora independently validates the merchant, order reference, expected amount and currency; frontend return/cancel routes only query server state. The provider checksum does not include `payment_id`, so Eventora uses it only as an audit/deduplication reference. Unfulfillable verified successes are preserved with payment exceptions and never trigger automatic refunds or inventory/ticket changes.

Tickets are issued only within the verified, fulfillable payment transaction. Ticket list and detail queries scope by the authenticated database user; details also require a confirmed registration. Random ticket references produce stable HMAC-SHA256 QR tokens under the server-only `TICKET_QR_SECRET`; the database stores only a SHA-256 hash of each token. QR images are generated only for the ticket owner. Keep this signing secret stable and out of frontend builds. Email outbox errors store safe codes rather than raw SMTP messages, and mail content escapes untrusted event, organizer, and attendee text.

Organizer check-in routes require a Clerk session, active database account, organizer role, and approved organizer application. The service verifies event ownership in PostgreSQL and checks that the ticket belongs to the event, is not voided or already checked in, its registration is confirmed, and a payment attempt is currently `SUCCEEDED`. QR scans validate the stored token hash and HMAC; manual references use the same ticket and payment checks. The service locks the event for a shared read and locks the ticket row for update inside one transaction before creating the unique per-ticket check-in and changing ticket status. Attendance responses expose ticket reference/type and check-in metadata only, never attendee contact details or internal ticket IDs.

## Public catalog

Public event list, featured, detail, schedule, and ticket-type queries filter by `PUBLISHED` in the database. A draft or missing event returns the same not-found response from detail/schedule/ticket endpoints. Public projections omit organizer records, event capacity, and internal ticket reservation/sold counters; ticket availability is derived from those counters without exposing the raw values. Public category reads include active categories only. Administrator category writes use the database-backed guards, and deletion checks both existing event references and the restrictive foreign key to preserve historical category associations.

Local configuration and invalid-token/webhook-signature behavior have been checked. Phase 3 still needs a real Clerk-issued session through `/api/auth/me`, database-backed account-status verification, and delivery from the configured Clerk Dashboard endpoint before authentication can be marked fully verified.
