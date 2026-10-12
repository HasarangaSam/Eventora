# Local Development

## Prerequisites

- Node.js compatible with the installed Vite and NestJS CLI versions.
- npm.
- A Supabase PostgreSQL project and its Session pooler connection string for backend database work.
- A Clerk publishable key for frontend sign-in UI.

## Environment files

Environment files are local and ignored by Git:

- Copy `frontend/.env.example` to `frontend/.env.local`; set `VITE_CLERK_PUBLISHABLE_KEY` from the Clerk dashboard. Only a publishable key belongs in the frontend.
- Copy `backend/.env.example` to `backend/.env`; set `DATABASE_URL` to the Supabase Session pooler URL and keep all database credentials server-side.

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

## Database setup

From `backend/`, run `npm run prisma:validate` and `npm run prisma:generate`. Review `docs/DATABASE.md` before creating and applying the first migration. Do not run migrations against a production or valuable database without reviewing the migration and confirming a recovery path.
