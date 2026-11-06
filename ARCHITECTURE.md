# Eventora Architecture

This document describes the architecture currently implemented in the repository. Eventora is a browser-based React application backed by a modular NestJS API and a PostgreSQL database. The API is one application; its NestJS modules are code boundaries, not separately deployed services.

## System context

```mermaid
flowchart LR
    Browser[Attendee / Organizer / Admin browser]
    Frontend[React 19 + TypeScript SPA<br/>Vite in development · Nginx in Docker]
    API[NestJS API<br/>/api · modular monolith]
    DB[(PostgreSQL<br/>Prisma 7 + pg adapter)]
    Clerk[Clerk<br/>sign-in, JWT identity, webhooks]
    PayHere[PayHere<br/>hosted checkout + payment notification]
    Cloudinary[Cloudinary<br/>event cover images]
    SMTP[SMTP / Gmail<br/>purchase confirmation]

    Browser --> Frontend
    Frontend -->|JSON API + Clerk bearer token| API
    Frontend <-->|Clerk browser SDK| Clerk
    API -->|verify token / fetch identity| Clerk
    Clerk -->|signed user lifecycle webhook| API
    API <-->|Prisma queries, transactions, SQL row locks| DB
    API -->|create checkout request| PayHere
    PayHere -->|signed asynchronous notification| API
    API -->|upload / delete image| Cloudinary
    API -->|best-effort purchase email after commit| SMTP
```

In local development, Vite serves the frontend (typically port `5173`) and the API serves port `3000`. Docker Compose runs PostgreSQL, the NestJS API, and an Nginx-served frontend. Clerk, PayHere, Cloudinary, and SMTP are external integrations configured through environment variables.

## Application structure

```mermaid
flowchart TB
    subgraph UI[Frontend · React Router]
      Public[Public discovery<br/>home · search · event details]
      Attendee[Attendee workspace<br/>account · orders · tickets]
      Organizer[Organizer Studio<br/>events · setup · tickets · participants<br/>sales · check-in · notifications]
      Admin[Admin workspace<br/>applications · events · users · categories<br/>payments · reports · notifications]
      AuthUI[Clerk sign-in / sign-up<br/>current-user context · role landing]
      Shell[Shared dashboard shell<br/>role-specific navigation and content]
      Public --> AuthUI
      Attendee --> AuthUI
      Organizer --> Shell
      Admin --> Shell
    end

    subgraph Server[Backend · NestJS modules]
      Guards[Global request throttling<br/>route-level Clerk auth · active account · role checks]
      Auth[Auth & account sync]
      Events[Public events · organizer events<br/>admin oversight · event lifecycle]
      Applications[Organizer applications]
      Categories[Categories]
      Registration[Registrations + inventory reservations]
      Payments[PayHere checkout + webhook reconciliation]
      Tickets[Tickets + signed QR validation]
      Checkins[QR / manual check-in]
      Analytics[Organizer analytics + participant lists]
      Notifications[Organizer / admin notifications]
      Email[Purchase confirmation email]
      Images[Cloudinary image service]
      Persistence[Prisma service]
      Guards --> Auth
      Guards --> Events
      Guards --> Applications
      Guards --> Categories
      Guards --> Registration
      Guards --> Payments
      Guards --> Tickets
      Guards --> Checkins
      Guards --> Analytics
      Guards --> Notifications
      Events --> Images
      Events --> Registration
      Registration --> Payments
      Payments --> Tickets
      Payments --> Email
      Events --> Persistence
      Applications --> Persistence
      Categories --> Persistence
      Registration --> Persistence
      Payments --> Persistence
      Tickets --> Persistence
      Checkins --> Persistence
      Analytics --> Persistence
      Notifications --> Persistence
      Email --> Persistence
    end

    UI -->|HTTP /api| Guards
    Persistence --> DB[(PostgreSQL)]
```

The dashboard shell is shared presentation infrastructure. The organizer and admin screens, routes, permissions, and data remain separate. Frontend route guards improve navigation and feedback; the API independently enforces authorization.

## Authentication and authorization

```mermaid
sequenceDiagram
    actor User
    participant UI as React app
    participant Clerk as Clerk
    participant API as NestJS API
    participant DB as PostgreSQL

    User->>UI: Sign in / sign up
    UI->>Clerk: Authenticate
    Clerk-->>UI: Session and JWT
    UI->>API: GET /api/auth/me (bearer JWT)
    API->>Clerk: Verify token / resolve Clerk identity
    API->>DB: Find or synchronize application account
    DB-->>API: Role and account status
    API-->>UI: Current Eventora account
    UI->>UI: Route to attendee, organizer, or admin workspace

    Note over API,DB: Protected API operations check account status and required role server-side.
```

Clerk owns authentication identity. Eventora stores application roles (`ATTENDEE`, `ORGANIZER`, `ADMIN`) and account status in PostgreSQL. Organizer approval and role changes are application-side decisions; the browser cannot grant itself a role.

## Ticket purchase and fulfillment

```mermaid
sequenceDiagram
    actor Attendee
    participant UI as React app
    participant API as NestJS API
    participant DB as PostgreSQL
    participant PayHere
    participant Mail as SMTP

    Attendee->>UI: Select paid ticket tier and quantity
    UI->>API: POST /api/registrations
    API->>DB: Transaction: reserve inventory atomically; create registration and timed hold
    DB-->>API: Pending registration
    API-->>UI: Registration and hold expiry
    UI->>API: Start checkout for registration
    API->>DB: Verify ownership and active hold
    API-->>UI: PayHere hosted-checkout details
    UI->>PayHere: Redirect to hosted payment page
    PayHere-->>Attendee: Collect payment
    PayHere->>API: Signed payment notification
    API->>API: Verify provider signature and reconcile idempotently
    API->>DB: Transaction: update payment, commit/release inventory, confirm registration, issue tickets
    DB-->>API: Committed result
    API->>Mail: Best-effort confirmation email after commit
    API-->>PayHere: Acknowledge notification
    UI->>API: GET /api/tickets/me or /api/registrations/me
    API-->>UI: Tickets / order history
```

The payment provider notification is the source of truth for payment completion. A browser return page alone does not issue a ticket. Reservation expiry, payment reconciliation, and ticket issuance are persisted against PostgreSQL transactions; late or mismatched payments can be recorded for administrative review.

## Event operations and background work

```mermaid
flowchart LR
    Organizer[Organizer Studio] -->|create / edit / publish / cancel| EventAPI[Organizer Events API]
    Attendee[Public event pages] -->|discover published events| PublicAPI[Public Events API]
    Admin[Admin workspace] -->|moderate / manage| AdminAPI[Admin APIs]
    EventAPI --> DB[(PostgreSQL)]
    PublicAPI --> DB
    AdminAPI --> DB
    EventAPI -->|cover image| CDN[Cloudinary]
    Purchase[Successful purchase] -->|after database commit| Mail[EmailService → SMTP]
    Reservation[(InventoryReservation)] -->|expire held stock periodically| Inventory[InventoryService]
    Inventory --> DB
    Lifecycle[EventLifecycleService<br/>every 60 seconds] -->|mark ended published events complete| DB
    Door[Organizer check-in console] -->|QR or manual reference| CheckinAPI[Check-in API]
    CheckinAPI -->|verify signed token; prevent duplicate entry| DB
```

Purchase email is attempted after the payment transaction commits; SMTP failure does not roll back the payment and is not retried. Reservation-expiry and event-lifecycle jobs currently run as timers inside the NestJS application process.

## Main persisted concepts

```mermaid
erDiagram
    USER ||--o{ EVENT : organizes
    USER ||--o{ ORGANIZER_APPLICATION : submits
    EVENT ||--o{ EVENT_SESSION : schedules
    EVENT ||--o{ TICKET_TYPE : offers
    EVENT ||--o{ REGISTRATION : receives
    TICKET_TYPE ||--o{ REGISTRATION : selected_for
    REGISTRATION ||--o{ INVENTORY_RESERVATION : holds
    REGISTRATION ||--o{ PAYMENT_ATTEMPT : pays_with
    REGISTRATION ||--o{ TICKET : issues
    TICKET ||--o| CHECK_IN : admits
    EVENT ||--o{ EMAIL_DELIVERY : notifies
    REGISTRATION ||--o{ EMAIL_DELIVERY : confirms
    USER ||--o{ ADMIN_AUDIT_LOG : acts_in
    USER ||--o{ PAYMENT_EXCEPTION : reviews

    USER { string id string clerkUserId enum role enum status }
    EVENT { string id string organizerId string categoryId enum status datetime startAt datetime endAt }
    TICKET_TYPE { string id string eventId decimal price int quantity int quantityReserved int quantitySold }
    REGISTRATION { string id string userId string eventId int quantity decimal totalAmount enum status }
    INVENTORY_RESERVATION { string id string registrationId int quantity datetime expiresAt enum status }
    PAYMENT_ATTEMPT { string id string registrationId enum provider enum status }
    TICKET { string id string registrationId enum status string qrTokenHash }
    CHECK_IN { string id string ticketId enum method datetime checkedInAt }
```

This is a domain overview, not a complete ERD. The authoritative field definitions and relationship constraints are in [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma).

## Where to look in the repository

| Concern | Code location |
|---|---|
| Frontend bootstrap and route map | `frontend/src/main.tsx`, `frontend/src/app/routes.tsx` |
| Authenticated API requests and role context | `frontend/src/features/auth/` |
| Role dashboards | `frontend/src/features/organizer/`, `frontend/src/features/admin/`, `frontend/src/features/tickets/` |
| NestJS module composition | `backend/src/app.module.ts` |
| API startup, validation, CORS, `/api` prefix | `backend/src/main.ts` |
| Authentication and role guards | `backend/src/auth/` |
| Event, registration, payment, ticket, check-in domains | `backend/src/events/`, `backend/src/registrations/`, `backend/src/payments/`, `backend/src/tickets/`, `backend/src/checkins/` |
| Database model and migrations | `backend/prisma/schema.prisma`, `backend/prisma/migrations/` |
| Compose topology | `docker-compose.yml` |
