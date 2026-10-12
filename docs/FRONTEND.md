# Eventora Frontend Guide

This is Eventora's authoritative frontend UX and design direction. `docs/project-spec.md` remains the source of truth for business rules and technology. The design examples and proposed file tree are visual/structural references, not proof of implemented pages.

## Product experience

- Keep the warm orange identity (`#F97316`) with warm off-white surfaces, dark readable text, and restrained borders and shadows.
- Treat Eventora as event discovery and ticketing. Keep actual event API data, accessible controls, and useful loading, empty, error, and success states ahead of decorative dashboard elements.
- Do not show fabricated activity, sales, testimonials, social accounts, or organizer metrics.
- Use Clerk for identity and the backend's synchronized database role/status for access decisions. Frontend role routing improves navigation only; backend guards remain authoritative.
- Be explicit that analytics sales are **gross sales**, derived from verified successful payment attempts, and are not profit or organizer payouts. Preserve separate currency totals; do not combine currencies.
- The homepage is the editorial entry point and `/discover` is a separate, searchable event catalogue. Never collapse the catalogue into the landing page.

## Current frontend structure

The project uses React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Axios, and `@clerk/react`. Follow this existing structure rather than creating a parallel router/provider architecture:

```text
frontend/src/
  App.tsx                         # route table, public shell, account actions
  App.css                         # application and feature styles
  index.css                       # global styles and Tailwind
  lib/api.ts                      # shared Axios client
  features/
    auth/                         # account page and authenticated API hook
    events/                       # discovery, event cards, event details
    organizer/                    # event management, applications, check-in
    admin/                        # administrator tools
    payments/                     # checkout return states
    tickets/                      # ticket wallet
    analytics/                    # role-specific dashboard summaries
```

Keep feature code in its feature folder; add shared layout/UI abstractions only when at least two real use cases need them. Use the existing `useAuthenticatedApi` hook for bearer-authenticated requests and the Axios client for public API requests. Do not add form, state, or query libraries without an approved architectural reason.

## Existing routes and dashboard behavior

`App.tsx` registers `/` (home), `/discover` (the separate event catalogue), `/sign-in`, `/sign-up`, `/events/:eventId`, checkout result/cancelled, `/tickets`, organizer event check-in, `/account`, and `/admin`. The account view loads `/auth/me`; role-specific dashboard content is then loaded from:

| Database role | Dashboard API | Current responsibilities |
| --- | --- | --- |
| `ATTENDEE` | `GET /api/attendee/dashboard` | Recent registrations, event date/location, payment/registration state, active ticket count |
| approved `ORGANIZER` | `GET /api/organizer/dashboard` | Owned event/status summary, confirmed registrations, tickets, verified gross sales by currency, payment statuses, check-in rate, recent owned events |
| `ADMIN` | `GET /api/admin/dashboard` | User/role counts, active users, pending organizer applications, event/registration/payment totals, gross sales, attendance |

Organizer event detail analytics are available at `GET /api/organizer/events/:eventId/analytics`; the backend verifies ownership. `/account` is the role-aware dashboard surface, with role-specific navigation. The `/admin` workspace reviews applications and accounts, manages categories, and oversees the latest 100 platform events through `GET /api/admin/events`; it can cancel any eligible event through the admin-only cancellation endpoint while preserving history. Existing event-authoring, check-in, application-review, and ticket tools remain in their current feature views.

Dashboard values come from database counts/grouped aggregates and bounded recent-record queries. Keep empty states honest. Currency totals remain distinct. A payment redirect is never evidence of success; show only server-confirmed statuses. Do not use cancelled events as bookable events, but preserve historical metrics and records. Role navigation stays distinct while reusing the established orange/warm palette.

## UX and accessibility

- Use semantic landmarks/headings and explicit labels. Make links, buttons, keyboard focus, and errors perceivable without relying on color alone.
- Disable duplicate submission while a request is pending. Preserve values after recoverable failures.
- Make API errors retryable where retry is safe; do not report success before the API confirms it.
- Use responsive cards/lists on narrow screens; do not force dashboard tables wider than the viewport.
- Use real cover images returned by the API with a deliberate fallback.
- Keep dashboards role-specific and scoped. Never use a client-supplied role, event organizer ID, price, payment result, or ownership field as authorization evidence.

The separate Discover page reads filters and pagination from URL query parameters. The home page requests at most four recent published, eligible events and real category records. Build on these contracts without inserting sample event or sales data. Do not add social, legal, or support destinations until Eventora has real URLs and contact details to publish.

## Shared chrome and dashboard presentation

- Guests and attendees use the public navbar and footer. The public chrome uses a dark charcoal/navy surface, clear large navigation text, and the established warm orange accent.
- Organizer and admin workspaces use a full-height sidebar layout and omit the public navbar and footer. Attendee dashboards retain the public shell.
- Organizer sales charts use verified monthly gross sales grouped by currency. Admin role distribution and attendance visuals use the existing admin dashboard aggregates. Do not add decorative or fabricated analytics.
- Footer social marks remain non-interactive until Eventora's official social URLs are supplied; do not point users to generic platform pages or unrelated accounts.
