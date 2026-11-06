# Backend refactor plan for a clear interview story

Eventora is a single NestJS application backed by PostgreSQL. Its NestJS modules are code boundaries, not microservices. The goal of this plan is to keep the behavior needed by the product while making the implementation and its explanation easier to follow.

## Keep and be ready to explain

These parts directly support paid ticket sales and should remain until replaced by an equally safe implementation:

1. **Atomic inventory reservation** (`registrations/`, `InventoryService`). A conditional database update reserves event and ticket-type capacity inside the same transaction that creates the registration. This is what prevents concurrent requests from overselling.
2. **Payment-provider notification** (`payments/`). The verified PayHere server callback is the source of truth for payment completion. It checks the signature and expected amount/currency before confirmation.
3. **Idempotency** (`RegistrationsService.create`, database unique constraint). A retried request returns its original registration rather than charging inventory twice.
4. **Ticket fulfillment and check-in** (`payments/`, `tickets/`, `checkins/`). Tickets are issued after confirmation, QR payloads are verifiable, and the ticket row lock prevents a duplicate check-in.
5. **Purchase confirmation email** (`email/`). The API attempts it after payment and ticket issuance commit. SMTP failure cannot undo the purchase, and the email is not automatically retried.

The outbox was removed to keep the project smaller. This means a temporary SMTP outage or API crash can result in no confirmation email. The tickets remain available in the attendee account. Organizer-decision and event-cancellation email notifications are also omitted.

## Simplify in this order

### 1. Make the documentation match the code (first)

- Replace the promotional, implementation-heavy `README.md` with a short setup guide and a truthful request-flow overview.
- Remove guarantees the code does not provide, such as reliable or exactly-once email delivery.
- Keep this plan as the interview-oriented map; keep detailed design notes only for mechanisms that are actually implemented.

### 2. Reduce secondary machinery after the core flows are understood

- Review session-token-aware throttling and the multiple global throttler windows. Keep one understandable global limit plus a stricter limit on registration creation unless a measured use case needs more.
- Review the event lifecycle timer and reservation-expiry timer. Keep reservation expiry because it returns held stock; consider a simpler scheduled cleanup or on-demand expiry if this is only a demo deployment. Event completion can be derived at read time if persisted `COMPLETED` state is not needed.
- Review payment exception/audit paths against actual product needs. Preserve amount/signature validation and idempotent fulfillment; defer chargeback and multiple-success recovery workflows if they are not part of the demo, while documenting the resulting operational limitation.
- Keep authorization server-side, but explain the chain in one sentence: verify Clerk identity, load the Eventora account, check its role and organizer approval. Combine guards only if that makes the request path clearer without weakening those checks.

### 3. Improve readability without changing behavior

- Keep lock order consistent across reservation, expiry, cancellation, and payment reconciliation; document the order where it is acquired.
- Extract named helpers only when they give a business step a clear name (for example, `confirmRegistrationAndIssueTickets`). Avoid creating abstractions just to hide a few Prisma calls.
- Keep comments focused on *why* a transaction, lock, signature check, or retry exists. Avoid comments that merely restate the next line.
- Add or retain focused tests around concurrent reservations, repeated payment notifications, ticket issuance, and duplicate check-ins before changing these behaviors.

## Suggested interview explanation

“Eventora is a modular monolith: one NestJS API and one PostgreSQL database. For a purchase, the API atomically reserves capacity and creates a pending registration. PayHere's signed server notification confirms payment; in one database transaction the API commits inventory, confirms the registration, and creates tickets. After that commit, it attempts a confirmation email. PostgreSQL constraints and row locks protect retries and concurrent requests.”

If asked about tradeoffs: “Purchase emails are sent after the database transaction commits. I chose a best-effort notification for this project; if SMTP is unavailable, the paid order and tickets remain safe, but the email will not be retried.”

## Practical sequence

1. Walk through the files above and explain the purchase path before refactoring it.
2. Simplify the backend README and remove complexity that is not visible in the product demo.
3. Change one behavior at a time, starting with throttling or event lifecycle handling; do not rewrite payment and inventory together.
4. Run the existing focused registration and payment tests after each behavior change.

