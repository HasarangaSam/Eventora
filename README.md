# Eventora — Full-Stack Event Management and Ticketing Platform

Eventora is a full-stack event management and paid-ticketing platform built with React, TypeScript, NestJS, PostgreSQL, and Prisma. It enables attendees to discover events and purchase tickets, organizers to manage events and attendance, and administrators to oversee platform operations.

The project focuses on reliable payment processing, concurrency-safe ticket inventory, secure digital tickets, and maintainable full-stack architecture.

## Project Goals

- Build a complete event discovery and ticket purchasing experience.
- Integrate Clerk for authentication and identity management.
- Implement role-based authorization and administrator-approved organizer applications.
- Manage events, schedules, categories, and paid ticket types.
- Integrate real PayHere payment processing.
- Prevent ticket overselling and duplicate payment processing.
- Generate secure digital tickets with QR codes.
- Support reliable event check-in through QR scanning and manual ticket references.
- Send transactional emails for purchases, organizer decisions, and event cancellations.
- Provide dashboards and analytics for attendees, organizers, and administrators.
- Deliver a responsive, accessible, professional user interface.

## Technology Stack

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- React Router
- Axios
- Clerk React integration: `@clerk/react`
- Zod for appropriate client-side validation

### Backend

- Node.js
- NestJS
- TypeScript
- PostgreSQL hosted by Supabase
- Prisma ORM 7.x
- `@prisma/adapter-pg`
- `pg`
- `@nestjs/config`
- `@clerk/backend`
- `class-validator`
- `class-transformer`

### External Services

| Service                                             | Purpose                                                |
| --------------------------------------------------- | ------------------------------------------------------ |
| Clerk                                               | Authentication, sessions, and identity management      |
| Supabase                                            | PostgreSQL database hosting                            |
| PayHere                                             | Real ticket payment processing                         |
| Cloudinary                                          | Event cover image storage and delivery                 |
| Gmail SMTP                                           | Transactional email delivery                           |
| ngrok                                               | Local webhook development                              |
| Upstash Redis                                       | Appropriate rate limiting and purchase-related support |

Gmail SMTP uses a Google App Password. Configure backend-only credentials as described in [docs/EMAIL.md](docs/EMAIL.md). Redis should be introduced only where justified by the requirements.

## User Roles

### Attendee

Attendees can:

- Discover, search, and filter published events.
- View event details, schedules, and ticket availability.
- Purchase paid tickets.
- View registration and payment status.
- Access digital tickets and QR codes.
- Receive purchase and ticket confirmation emails.
- View upcoming and past events.

Free-ticket purchases, attendee registration cancellation, and attendee refund requests are outside the defined scope.

### Organizer

Organizers must receive administrator approval before managing events.

Approved organizers can:

- Create, edit, publish, and manage their own events.
- Upload event cover images.
- Manage event schedules and paid ticket types.
- View registrations and relevant attendee information.
- Monitor ticket sales and payment status.
- Scan ticket QR codes or validate ticket references manually.
- Review event attendance and analytics.

Organizers cannot manage events owned by other organizers.

### Administrator

Administrators can:

- Manage users, roles, and account status.
- Review organizer applications.
- Manage event categories and platform events.
- Monitor registrations and payment records.
- Review payment exceptions.
- View platform analytics and attendance reports.
- Cancel events while preserving historical records.

Public administrator registration is not supported.

## Core Business Rules

### Payments and ticket inventory

- All ticket types must have a price greater than zero.
- Ticket prices and payment totals are calculated by the backend.
- Inventory reservations must be concurrency-safe.
- Pending reservations expire after 10 minutes.
- PayHere server notifications must be verified before a registration is confirmed.
- Browser redirects cannot independently confirm successful payment.
- Duplicate payment notifications must not create duplicate tickets or repeat inventory adjustments.
- Late successful payments must be reconciled safely and recorded for administrative review when fulfillment is not possible.

### Digital tickets and check-in

- Tickets are issued only after verified payment success.
- Each ticket has a unique reference and secure QR token.
- Ticket ownership is verified before private ticket details are returned.
- QR scanning and manual ticket entry use the same backend validation rules.
- Check-in must prevent duplicate successful scans.

### Event cancellation

- Cancelled events cannot accept new purchases.
- Existing registrations, payments, tickets, and historical records are preserved.
- Registered attendees are notified of event cancellation.
- Event cancellation does not trigger an automatic refund.

## Architecture

Eventora separates the frontend, backend, database, and external integrations.

- **Frontend:** Presents the application interface, handles navigation and user interactions, and communicates with the backend API.
- **Backend:** Enforces authentication, authorization, validation, business rules, payment processing, ticket issuance, and check-in.
- **Database:** Stores application users, organizer applications, events, ticket inventory, registrations, payments, tickets, check-ins, and related records.
- **External services:** Provide authentication, payment processing, image storage, email delivery, and supporting infrastructure.

The backend is the security boundary. Frontend route protection does not replace backend authorization.

See [`docs/project-spec.md`](./docs/project-spec.md) for the complete requirements. Detailed architecture documentation will be added as the application architecture takes shape.

## Project Structure

The intended repository structure separates the frontend and backend:

```text
eventora/
├── agents.md
├── README.md
├── docs/project-spec.md
├── IMPLEMENTATION_PLAN.md
├── .gitignore
├── docs/
├── frontend/  # Vite and React application
└── backend/   # NestJS API
```

This is the intended structure, not a claim that every file or feature already exists. Follow the actual repository structure during implementation and create modules progressively.

## Prerequisites

Install and configure the following as required by the current implementation:

- Node.js version compatible with the selected dependencies.
- npm.
- Git.
- A Supabase PostgreSQL project.
- A Clerk application.
- A PayHere merchant account and credentials for the required environment.
- A Cloudinary account.
- Access to the confirmed transactional email provider.
- ngrok for local webhook testing.

Use the installed dependency versions and official documentation when configuring integrations.

## Environment Configuration

Environment variables are maintained separately for the frontend and backend.

Typical configuration categories include:

**Frontend**

- API base URL.
- Clerk publishable key.

**Backend**

- PostgreSQL connection configuration.
- Clerk secret and webhook verification configuration.
- PayHere merchant configuration and secrets.
- Cloudinary credentials.
- Transactional email configuration.
- Redis connection configuration when required.
- Application port, frontend origin, and other runtime settings.

Use `.env.example` files to document required variable names and safe example values. Never commit real credentials or expose backend secrets to the browser.

The exact variable names, validation rules, and setup instructions must match the actual implementation.

## Development Roadmap

Eventora is implemented incrementally.

1. Project setup and health endpoint.
2. Database configuration and schema.
3. Clerk authentication and user synchronization.
4. Roles and organizer approval.
5. Categories and public event discovery.
6. Organizer event management, images, sessions, and ticket types.
7. Registration and concurrency-safe inventory reservations.
8. Real PayHere integration and payment verification.
9. Digital ticket issuance and transactional email.
10. QR scanning, manual check-in, and attendance.
11. Role-specific dashboards and analytics.
12. Final integration testing, security review, and deployment preparation.

The actual completion status is tracked in [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md).

## Local Development

The first project foundation is split into `frontend/` and `backend/`.

1. Install dependencies in each folder with `npm install`.
2. Copy `frontend/.env.example` to `frontend/.env.local` and add a Clerk publishable key to enable sign-in. The UI can run without it.
3. Copy `backend/.env.example` to `backend/.env`; adjust the frontend origin if needed.
4. Start the API from `backend/` with `npm run start:dev`.
5. Start the web app from `frontend/` with `npm run dev`.

The API health check is `GET http://localhost:3000/api/health`. The backend allows browser requests from `FRONTEND_ORIGIN` (default `http://localhost:5173`).

## Quality and Testing

Testing focuses on business correctness as well as application behavior.

Important areas include:

- Authentication and role authorization.
- Organizer approval and event ownership.
- Ticket price and inventory validation.
- Concurrent purchases and reservation expiry.
- PayHere notification verification and idempotency.
- Ticket issuance after verified payment.
- Ticket ownership and duplicate check-in prevention.
- Event cancellation and historical data preservation.
- Email delivery failures and retries.
- Frontend loading, empty, error, and success states.

Run only commands defined by the current repository configuration. Typical checks may include:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Run these commands from the appropriate workspace and adjust them to the actual package scripts and TypeScript configuration. Do not treat an unexecuted check as passing.

## Documentation

- [`agents.md`](./agents.md): Coding-agent workflow and implementation rules.
- [`docs/project-spec.md`](./docs/project-spec.md): Authoritative product requirements.
- [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md): Implementation progress and verification.
- [`docs/DATABASE.md`](./docs/DATABASE.md): Prisma schema, integrity notes, and database setup.
- [`docs/SECURITY.md`](./docs/SECURITY.md): Authentication boundaries, account status, and webhook verification.
- [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md): Local development, Clerk keys, and webhook setup.

Create supporting documents as they become relevant. Do not document unimplemented functionality as complete.

## Project Status

Eventora is being developed incrementally according to its authoritative specification. Features, integrations, and quality checks should be described as complete only after implementation and verification.

The immediate priority is a reliable end-to-end application with correct authorization, payment processing, inventory management, ticket issuance, and check-in before additional polish or unnecessary complexity.

## License

The project license has not yet been specified. Add the appropriate license before distributing the project under explicit licensing terms.
