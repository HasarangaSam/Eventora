# Eventora Frontend — React 19 UI Architecture & Engineering Guide

> A high-performance, accessible, and responsive single-page application built with **React 19**, **TypeScript**, **Vite**, **Tailwind CSS v4**, and **Recharts**. Features dual public and workspace layout paradigms, zero-trust role-aware routing, interactive analytics, and native camera QR scanning.

---

## Technical Stack & Architecture

| Technology | Version | Architectural Role |
|---|---|---|
| **React** | ^19.2 | Core UI library utilizing modern concurrent rendering patterns |
| **TypeScript** | ^6.0 | Strict end-to-end type safety |
| **Vite** | ^8.3 | Lightning-fast build tool and HMR development server |
| **React Router** | ^8.4 | Declarative client-side routing, nested layouts, and URL parameter syncing |
| **Tailwind CSS** | ^4.3 | Utility-first styling combined with a custom design token system |
| **Recharts** | ^3.10 | Responsive data visualizations (Area, Bar, Pie, and Donut charts) |
| **@zxing/browser** | ^0.2 | Native HTML5 video camera QR code reader and barcode decoder |
| **@clerk/react** | ^6.17 | Client-side identity provider and JWT session management |
| **Axios** | ^1.20 | Centralized HTTP client with automatic Bearer token injection |

---

## Design System & UX Standards

The interface is engineered around an editorial, premium aesthetic:
- **Refined Modern Palette:** Rooted in electric Indigo (`#6366f1`), deep Slate surfaces (`#0F172A`), Rose highlights (`#f43f5e`), warm off-white backgrounds (`#f8fafc`), and clean slate borders.
- **Glassmorphism & Micro-Interactions:** Subtle backdrop filters, smooth hover card lifts, and transition states across cards, buttons, and badges.
- **Dual Shell Layouts:**
  - **Public Shell:** Used for homepage, event discovery, event details, checkout results, and attendee wallet. Features sticky navigation and comprehensive footer.
  - **Workspace Shell (`DashboardShell`):** Dedicated full-height collapsible sidebar layout for Organizers and Administrators, maximizing screen real estate for dense tables, forms, and charts.
- **Accessible & Honest Feedback:** Comprehensive empty states, inline skeleton/spinner loading indicators, and informative server error banners.

---

## Key Functional Modules

```
frontend/src/
├── features/
│   ├── analytics/               # DashboardShell sidebar layout & role KPI cards
│   ├── auth/                    # Account page, Clerk wrapper styling, CurrentUserContext
│   ├── events/                  # Catalog discovery, filter engine, event detail purchase flow
│   ├── home/                    # Rich editorial landing page (How it Works, QR entry, featured)
│   ├── organizer/               # Event studio (full CRUD), check-in station, sales analytics
│   ├── admin/                   # Admin platform analytics, applications queue, user moderation
│   ├── payments/                # Checkout result & cancellation handlers (server polling)
│   └── tickets/                 # Digital ticket wallet with QR token presentation
├── components/
│   ├── ui/                      # Reusable UI primitives (buttons, modals, badge, icons)
│   └── shared/                  # Navbar, footer, layout wrappers
├── lib/
│   └── api.ts                   # Axios client instance with base URL configuration
├── App.tsx                      # Root route registry and layout composition
└── main.tsx                     # React 19 bootstrap with ClerkProvider
```

---

## Detailed Feature Breakdown

### 1. Interactive Analytics & Visualizations (`Recharts`)
Both the Admin and Organizer workspaces feature live data visualizations backed by real database metrics (never mocked or hardcoded):
- **Platform Growth & Sales Trends:** Responsive `<AreaChart>` tracking gross revenue and registered ticket volume across multi-month windows with gradient fills and active tooltips.
- **Status & Role Distribution:** Responsive `<PieChart>` (donut presentation) breaking down user roles and event publication states.
- **Volume & Monthly Breakdown:** Responsive `<BarChart>` depicting monthly ticket counts and revenue performance.

### 2. Live QR Door Check-in Station (`@zxing/browser`)
Organizers have access to a dedicated check-in hub (`/organizer/events/:id/check-in`):
- **Continuous Camera Stream:** Utilizes `@zxing/browser` `BrowserMultiFormatReader` to scan ticket QR tokens in real-time from mobile or desktop webcams.
- **Zero-Flicker Feedback:** Visual success/failure overlays and audio feedback upon ticket verification.
- **Fallback Manual Entry:** Supports manual ticket reference entry for rapid attendee verification.
- **Duplicate Prevention:** Immediate on-screen notification if a ticket has already been checked in.

### 3. Event Discovery & URL State Management
The `/discover` catalog provides an eCommerce-grade search experience:
- **Filter Persistence:** Category, search queries, date bounds, and sort directions are synchronized directly with URL query parameters (`useSearchParams`).
- **Deep-Linkable:** Filters can be shared, bookmarked, and restored on reload.
- **Pagination Controls:** Server-side pagination with dynamic page size and total count feedback.

### 4. Zero-Trust Security & Role Enforcement
- **Backend Authority:** The frontend never assumes roles based on JWT claims. Upon login, `CurrentUserContext` fetches the authoritative user record from `GET /api/auth/me`.
- **Protected Routing:** Routes check `currentUser.role` (`ATTENDEE`, `ORGANIZER`, `ADMIN`) and account `status`. Deactivated accounts or unauthorized roles are redirected cleanly.
- **Authenticated API Client:** The `useAuthenticatedApi` hook intercepts all outbound HTTP requests, fetches a fresh session token via Clerk's `getToken()`, and injects it as an `Authorization: Bearer <token>` header.

### 5. Ticket Wallet & Post-Checkout Polling
- **Ticket Wallet (`/tickets`):** Attendees can inspect all issued tickets, view high-contrast QR codes rendered on demand, and check session schedules.
- **Checkout Result (`/checkout/result`):** Following a payment redirect from PayHere, the client never trusts query parameters. It polls `GET /api/registrations/:id` to display the server-confirmed order status.

---

## Development & Build Commands

```bash
# Install dependencies
npm install

# Start Vite development server with HMR (port 5173)
npm run dev

# Run TypeScript typecheck and create production build
npm run build

# Preview the production bundle locally
npm run preview

# Fast linter with oxlint
npm run lint
```

---

## Environment Variables

Configured in `frontend/.env.local`:

| Variable | Required | Description |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk public API key (safe to expose in client bundle) |
| `VITE_API_BASE_URL` | Optional | Backend API base URL (defaults to `http://localhost:3000/api`) |
