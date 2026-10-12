# Email delivery

Eventora sends transactional email through Gmail's authenticated SMTP service using `smtp.gmail.com` on port `465` with TLS. Use the complete Gmail address and a Google App Password; never use the account password. Google requires 2-Step Verification for app passwords and can revoke them when the account password changes. See [Google's App Password help](https://support.google.com/accounts/answer/185833?hl=en), [Gmail SMTP settings](https://support.google.com/a/answer/176600?hl=en), and [Nodemailer's SMTP transport documentation](https://nodemailer.com/smtp).

Keep these values in `backend/.env`, never in frontend variables or source control:

```dotenv
GMAIL_USER=your-account@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password
EMAIL_FROM=Eventora <your-account@gmail.com>
TICKET_QR_SECRET=at-least-32-random-bytes-kept-stable
FRONTEND_ORIGIN=http://localhost:5173
```

The backend has a database-backed outbox. Verified payment confirmation, organizer application decisions, and event cancellation queue their messages transactionally with the underlying business change. The worker claims due rows with PostgreSQL `FOR UPDATE SKIP LOCKED`, processes up to ten at a time, and polls every 30 seconds. It retries failures up to five total attempts with exponential delay, then marks the row `FAILED`; safe error codes are stored instead of SMTP response text or credentials. Repeated business events are deduplicated using `EmailDelivery.idempotencyKey`, and each delivery uses a stable Message-ID.

Purchase messages are queued only after payment verification, registration confirmation, inventory commit, and ticket creation succeed in the same transaction. The email includes the event details, ticket references, private QR tokens, and the attendee's `/tickets` link. Ticket tokens are deterministic HMAC values derived from random ticket references and `TICKET_QR_SECRET`; only their SHA-256 hashes are stored in PostgreSQL. Keep the QR signing key stable across deployments. Rotating it invalidates existing QR tokens and requires a planned migration/re-issuance process.

SMTP delivery is at-least-once: a process failure after Gmail accepts a message but before the database records `SENT` can cause a retry. The stable Message-ID helps downstream mail clients identify such repeats, but Gmail SMTP does not provide an idempotency key. Payment, registration, and ticket creation remain idempotent regardless of email delivery.

For local setup, add the values to `backend/.env`, then restart the NestJS backend. The worker sends pending outbox rows automatically. Delivery status, attempt count, next retry time, and safe failure code are stored on `EmailDelivery`. Do not copy live credentials into `.env.example`, documentation, logs, screenshots, or commits.
