# Security Notes

## Authentication and identity

Clerk authenticates users. Eventora stores the unique Clerk user ID and owns the application role and account status in PostgreSQL. Never accept a user ID, role, or account status supplied by the browser as authorization evidence.

The backend's `ClerkAuthGuard` accepts a session bearer token only, verifies it through `@clerk/backend`, and checks the token's authorized party against `FRONTEND_ORIGIN`. `GET /api/auth/me` synchronizes the authenticated Clerk profile using the verified token subject and returns the corresponding Eventora record. Profile synchronization uses an upsert keyed by the unique `clerkUserId`; its update fields deliberately exclude role and status. Deactivated accounts receive `403 Forbidden` from the current-user endpoint.

Frontend route protection and Clerk components improve the user experience. They do not replace backend token verification. Role-specific endpoint guards and organizer approval checks are a later implementation phase; no business API should be treated as protected until those backend guards are implemented.

## Clerk webhook

`POST /api/auth/webhooks/clerk` is public because Clerk sends server-to-server requests without a user session. Nest preserves the raw request body, and Clerk's `verifyWebhook` helper validates its signature with `CLERK_WEBHOOK_SIGNING_SECRET`. Invalid signatures are rejected. Repeated create/update deliveries use a unique-ID upsert; repeated delete deliveries use an idempotent status update. `user.deleted` deactivates the matching Eventora record rather than deleting financial or registration history.

Subscribe the Clerk endpoint only to `user.created`, `user.updated`, and `user.deleted`. Use ngrok for local webhook delivery as described in `DEVELOPMENT.md`. Do not log webhook payloads, session tokens, secret keys, or full database connection strings.

## Required configuration

- `VITE_CLERK_PUBLISHABLE_KEY` is public and belongs in `frontend/.env.local`.
- `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `CLERK_WEBHOOK_SIGNING_SECRET` belong in `backend/.env`; only the secret and webhook signing secret are confidential.
- `FRONTEND_ORIGIN` must be the exact frontend origin allowed to issue Clerk session tokens.
- Require Clerk sign-ups to provide a primary email address; Eventora's user schema requires one.

Local configuration and invalid-token/webhook-signature behavior have been checked. Phase 3 still needs a real Clerk-issued session through `/api/auth/me`, database-backed account-status verification, and delivery from the configured Clerk Dashboard endpoint before authentication can be marked fully verified.
