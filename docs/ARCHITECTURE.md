# Current Architecture

## Application boundaries

- `frontend/` is a React 19 and TypeScript Vite application. `App.tsx` provides the home, event detail, account, and administrator routes; feature components live under `src/features/`.
- `backend/` is a NestJS application with feature modules registered in `src/app.module.ts`. Controllers parse HTTP input and services query PostgreSQL through `PrismaService`.
- Supabase PostgreSQL is the system of record. Prisma 7 uses `@prisma/adapter-pg` and the configured session-pooler URL.
- Clerk authenticates users. Eventora roles and account status remain database-owned and are enforced by backend guards.

## Implemented backend modules

- `AuthModule`: Clerk bearer-token verification, current-user synchronization, and signature-verified Clerk webhook handling.
- `OrganizerApplicationsModule`: applicant history, admin decisions, database role/status management, and the transactional organizer-decision email outbox entry.
- `CategoriesModule`: public active-category reads and administrator category create/update/disable/delete operations. Deletion is refused while any event references a category.
- `EventsModule`: public published-event discovery and organizer-owned event management, including publication transitions, Cloudinary covers, schedule entries, and paid ticket types.
- `PrismaModule`: shared Prisma client connected through the PostgreSQL adapter.

## Public catalog behavior

`GET /api/events` accepts `page` (default 1, maximum 10,000), `pageSize` (default 12, maximum 48), `search`, `categoryId`, `from`, `to`, `sort` (`startAt`, `newest`, or `title`), and `direction` (`asc` or `desc`). Search checks title, description, venue, and city. Without an explicit date range, ended events are omitted. Results include `items` and a `pagination` object with total result count and page count.

All public event queries require `status = PUBLISHED`. Public event projections omit organizer identity, event capacity, and internal inventory counters. Event details, schedules, and active ticket types return 404 for unpublished or missing events. Public prices are serialized as exact decimal strings; ticket availability is derived from ticket-type inventory and remaining event capacity.

Other public catalog routes are `GET /api/events/featured`, `GET /api/events/:eventId`, `GET /api/events/:eventId/sessions`, `GET /api/events/:eventId/ticket-types`, `GET /api/categories`, and `GET /api/categories/:categoryId` (category ID or slug).

The administrator category inventory is `GET /api/categories/admin/list`; create, update, and delete use the corresponding `/api/categories` routes with database-backed admin authorization.

## Current frontend routes

- `/`: event discovery, featured events, search and filters, pagination, and the local hero asset.
- `/events/:eventId`: event information, schedule, ticket prices, and availability.
- `/account`: synchronized account details and the attendee organizer-application panel.
- `/admin`: administrator application review, account management, and category management.

Registration, checkout, and ticket issuance remain future phases; the catalog currently presents purchase availability without a checkout action.

Organizer management is available under `/api/organizer/events` and requires a Clerk session, active Eventora account, organizer role, and approved organizer application. Organizers can create drafts, list and edit their own events, publish/unpublish/cancel, manage schedule entries and paid ticket types, upload/remove cover images, and delete events only before registration or inventory history exists. Publication requires valid future event dates, an active category, complete public details, and at least one active paid ticket type with inventory and a usable sales window. Unpublishing is refused after registrations or inventory commitments; cancellation preserves those records and adds idempotent `EVENT_CANCELLATION` deliveries for confirmed attendees.

The organizer frontend is available on the signed-in `/account` page for organizer accounts. Cover uploads are limited to 5 MiB JPEG, PNG, or WebP and checked by file signature before the backend streams them to Cloudinary. Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in `backend/.env`. A cover must be removed before an otherwise history-free event can be deleted.
