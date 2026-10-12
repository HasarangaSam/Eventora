# Local Development

## Prerequisites

- Node.js compatible with the installed Vite and NestJS CLI versions.
- npm.
- A Supabase PostgreSQL project and its Session pooler connection string for backend database work.
- A Clerk application with a publishable key, secret key, and webhook signing secret.

## Environment files

Environment files are local and ignored by Git:

- Copy `frontend/.env.example` to `frontend/.env.local`; set `VITE_CLERK_PUBLISHABLE_KEY` from the Clerk dashboard. Only the publishable key belongs in the frontend.
- Copy `backend/.env.example` to `backend/.env`; set `DATABASE_URL` to the Supabase Session pooler URL, `CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY`. Keep database credentials and the Clerk secret key server-side.
- Set `CLERK_WEBHOOK_SIGNING_SECRET` to the signing secret for the configured Clerk webhook endpoint. Never commit the actual `.env` files.

## Start the applications

Install dependencies once in both application folders:

```sh
cd frontend
npm install
npm run dev
```

In another terminal:

```sh
cd backend
npm install
npm run start:dev
```

The frontend uses `VITE_API_BASE_URL`, defaulting to `http://localhost:3000/api`. The public health endpoint is `GET /api/health`. Configure `FRONTEND_ORIGIN` in the backend when the frontend uses a different origin.

Organizer event cover uploads require a Cloudinary account. Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` to `backend/.env`; keep all three values server-side and out of frontend environment files. Uploads accept JPEG, PNG, and WebP files up to 5 MiB. Without these values, event and ticket management work, while cover upload and deletion return a service configuration error.

Transactional email uses Gmail SMTP. Configure `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_FROM`, and a stable `TICKET_QR_SECRET` in `backend/.env` as described in [EMAIL.md](./EMAIL.md). The Gmail value must be a 16-character Google App Password, not the account password. Keep credentials out of commits and frontend configuration.

Public catalog routes include `GET /api/categories`, `GET /api/events`, `GET /api/events/featured`, `GET /api/events/:eventId`, and the event `sessions` and `ticket-types` routes. Event list queries support page/pageSize, search, categoryId, from/to ISO timestamps, sort, and direction. See `ARCHITECTURE.md` for defaults, response shape, and public-field restrictions.

Approved organizers manage events at `/api/organizer/events`; see `ARCHITECTURE.md` and `SECURITY.md` for ownership checks, status transition rules, ticket inventory protections, and the cover image configuration.

Approved organizers can open an event’s check-in page from the organizer workspace. `POST /api/check-ins/validate` checks a ticket without recording attendance; `POST /api/check-ins` records check-in. The event-scoped organizer routes use the same service. `@zxing/browser` requests camera access only after the scanner is started; use HTTPS or localhost and allow camera permission. If a camera is unavailable or permission is denied, enter the attendee’s ticket reference manually. Attendance history is available in pages of 25 rows.

## Clerk authentication and webhooks

The frontend Clerk provider uses `VITE_CLERK_PUBLISHABLE_KEY`. Signed-in users can open `/account`; that page requests `GET /api/auth/me` with the Clerk session token in an `Authorization: Bearer ...` header. The backend verifies the token, synchronizes the identity by Clerk user ID, and returns the Eventora role and account status from PostgreSQL. Clerk profile updates do not set or reset those application-controlled fields.

Configure a Clerk webhook endpoint at `https://<public-host>/api/auth/webhooks/clerk` and subscribe it to `user.created`, `user.updated`, and `user.deleted`. Copy its signing secret to `CLERK_WEBHOOK_SIGNING_SECRET`. The endpoint verifies the signature against the preserved request body, synchronizes profile changes idempotently, and deactivates matching Eventora accounts after Clerk user deletion.

Configure the Clerk sign-up methods to collect a primary email address because the Eventora user record requires one. A profile without a primary email cannot be synchronized.

For local webhook delivery, run the backend, then start a tunnel with `ngrok http 3000`. Create a Clerk webhook endpoint using the ngrok HTTPS URL plus `/api/auth/webhooks/clerk`, select the three user events above, and place that endpoint's signing secret in `backend/.env`. Recreate or update the endpoint when the ngrok URL changes. Set `FRONTEND_ORIGIN` to the exact browser origin used by the frontend; the backend checks this origin when accepting Clerk session tokens. PayHere sandbox setup, configuration, and notification testing are documented in [`PAYMENTS.md`](PAYMENTS.md).

Google sign-in is controlled in the Clerk Dashboard and remains optional. Enable Google there only if the Eventora Clerk application has that OAuth connection configured.

## Database setup

From `backend/`, run `npm run prisma:validate` and `npm run prisma:generate`. Review `docs/DATABASE.md` before creating and applying the first migration. Do not run migrations against a production or valuable database without reviewing the migration and confirming a recovery path.

## Initial administrator

After the first user has signed in and synchronized to the database, provision that account as the initial administrator from `backend/`:

```sh
npm run admin:provision -- user_<clerk-id>
```

The command refuses to run if an active administrator already exists or if the target account is missing or deactivated. Keep the selected Clerk user ID in a trusted operator workflow; do not expose administrator provisioning through the frontend or a public API.
