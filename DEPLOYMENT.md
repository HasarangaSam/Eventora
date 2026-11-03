# Eventora Deployment Guide

This repository is pre-configured for zero-friction deployment:
- **Frontend** → [Vercel](https://vercel.com)
- **Backend (API)** → [Render](https://render.com)

---

## 1. Deploy Backend to Render

### Option A: Using Render Blueprint (Recommended)
1. Push your changes to your Git repository (GitHub/GitLab).
2. Go to your [Render Dashboard](https://dashboard.render.com/) and click **New +** → **Blueprint**.
3. Select your repository. Render will automatically detect `render.yaml`.
4. Render will prompt you for the missing environment variables marked `sync: false`:
   - `DATABASE_URL`: Your PostgreSQL connection string (Supabase, Neon, or Render PostgreSQL).
   - `FRONTEND_ORIGIN`: Your Vercel domain (e.g. `https://eventora.vercel.app`).
   - `CLERK_PUBLISHABLE_KEY` & `CLERK_SECRET_KEY`: From your Clerk dashboard.
   - `CLERK_WEBHOOK_SIGNING_SECRET`: From Clerk webhooks.
   - Cloudinary & PayHere credentials (if enabled).
5. Click **Apply**. Render will automatically run Prisma migrations and start your NestJS service.

### Option B: Manual Web Service on Render
If creating a manual web service instead of a blueprint:
- **Root Directory**: `backend`
- **Runtime**: `Node`
- **Build Command**: `npm install && npx prisma generate && npm run build`
- **Pre-deploy Command**: `npx prisma migrate deploy`
- **Start Command**: `npm run start:prod`
- **Health Check Path**: `/api/health`

---

## 2. Deploy Frontend to Vercel

1. Go to your [Vercel Dashboard](https://vercel.com/new) and click **Add New...** → **Project**.
2. Import your GitHub repository.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend` (or leave default root, both `frontend/vercel.json` and root `vercel.json` are provided)
4. Under **Environment Variables**, add:
   - `VITE_CLERK_PUBLISHABLE_KEY`: Your Clerk publishable key (`pk_...`).
   - `VITE_API_BASE_URL`: Your Render backend URL with the `/api` prefix, e.g.:
     ```
     https://eventora-backend.onrender.com/api
     ```
5. Click **Deploy**.

> **Note on Client-Side Routing**: The added `vercel.json` includes SPA rewrites (`/(.*) -> /index.html`), ensuring direct URLs like `/tickets` or `/events/:slug` work properly without 404 errors on page refresh.

---

## 3. Connect Frontend & Backend

Once both are deployed:
1. Copy your Vercel production URL (e.g., `https://eventora.vercel.app`).
2. Go to Render → Your Web Service → **Environment**, and set:
   ```env
   FRONTEND_ORIGIN=https://eventora.vercel.app
   ```
3. In Clerk Dashboard:
   - Add your Vercel domain to **Allowed Origins** and **Redirect URLs**.
4. In PayHere Dashboard (if testing payments):
   - Set Return / Cancel / Notify URLs to your production domains.

