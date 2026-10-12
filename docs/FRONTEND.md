# Eventora Frontend Guide

This guide records the frontend direction and structure that match the current Eventora application. `docs/project-spec.md` remains authoritative for product and business requirements. The supplied design direction is a visual and UX reference; its mock content and proposed tree are not implementation evidence.

## Product experience

- Keep the warm orange identity (`#F97316`) with warm off-white surfaces, dark readable text, and restrained borders and shadows.
- Treat Eventora as event discovery and ticketing. Keep actual event API data, accessible controls, and useful loading, empty, error, and success states ahead of decorative dashboard elements.
- Do not show fabricated activity, sales, testimonials, social accounts, or organizer metrics.
- Use Clerk for identity and the backend's synchronized database role/status for access decisions. Frontend role routing improves navigation only; backend guards remain authoritative.
- Be explicit that analytics sales are **gross sales**, derived from verified successful payment attempts, and are not profit or organizer payouts. Preserve separate currency totals; do not combine currencies.

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

`App.tsx` currently registers `/`, `/events/:eventId`, checkout result/cancelled, `/tickets`, organizer event check-in, `/account`, and `/admin`. The account view loads `/auth/me`; role-specific dashboard content is then loaded from:

| Database role | Dashboard API | Current responsibilities |
| --- | --- | --- |
| `ATTENDEE` | `GET /api/attendee/dashboard` | Recent registrations, event date/location, payment/registration state, active ticket count |
| approved `ORGANIZER` | `GET /api/organizer/dashboard` | Owned event/status summary, confirmed registrations, tickets, verified gross sales by currency, payment statuses, check-in rate, recent owned events |
| `ADMIN` | `GET /api/admin/dashboard` | User/role counts, active users, pending organizer applications, event/registration/payment totals, gross sales, attendance |

Organizer event detail analytics are available at `GET /api/organizer/events/:eventId/analytics`; the backend verifies ownership. `/account` is the current role-aware dashboard surface. Existing event-authoring, check-in, application-review, and ticket tools remain in their current feature views.

Dashboard values come from database counts/grouped aggregates and bounded recent-record queries. Keep empty states honest. Currency totals remain distinct. A payment redirect is never evidence of success; show only server-confirmed statuses. Do not use cancelled events as bookable events, but preserve historical metrics and records.

## UX and accessibility

- Use semantic landmarks/headings and explicit labels. Make links, buttons, keyboard focus, and errors perceivable without relying on color alone.
- Disable duplicate submission while a request is pending. Preserve values after recoverable failures.
- Make API errors retryable where retry is safe; do not report success before the API confirms it.
- Use responsive cards/lists on narrow screens; do not force dashboard tables wider than the viewport.
- Use real cover images returned by the API with a deliberate fallback.
- Keep dashboards role-specific and scoped. Never use a client-supplied role, event organizer ID, price, payment result, or ownership field as authorization evidence.

## Next UI work

The project spec remains the acceptance source for discovery, ticketing, organizer, and admin experience. Dashboard trend charts, rich filters, URL-synchronized catalog state, and a dedicated persistent sidebar shell should be added only with their complete API/data behavior and responsive/accessibility states; this guide does not claim those are already implemented.
