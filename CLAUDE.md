# Jivatma

## Self-Maintenance
This file is the single source of truth for the Jivatma project. Every Claude Code session that changes the codebase MUST update this file to reflect the changes before finishing. This includes: adding new features to the feature list, updating the schema section if tables change, adding new API routes, updating the status of features, and noting any new known issues. When in doubt, update CLAUDE.md.

## Overview

Yoga studio management web app for Jivatma in Medellin, Colombia. Students can register, view the class schedule, book classes, and track their passes and attendance. Admins manage the schedule, mark attendance (which auto-deducts class passes), assign passes, and configure studio settings.

## Tech Stack

- **Frontend:** Vanilla HTML / CSS / JavaScript (no framework, no build step)
- **Backend:** Node.js serverless functions on Vercel
- **Database:** PostgreSQL via Supabase (hosted at `rrqvnrolqollitlhpvjw.supabase.co`)
- **Auth:** Supabase Auth (email/password) with JWT tokens
- **Hosting:** Vercel (auto-deploy from GitHub `main` branch)
- **Package manager:** npm
- **Language:** ES modules throughout (`import`/`export`, `"type": "module"` in package.json)

## Project Structure

```
api/                    → Vercel serverless functions (each file = one endpoint)
  admin/                → Admin-only endpoints (auth guard: verifyAdmin)
  cron/                 → Vercel cron jobs
  me/                   → Authenticated user endpoints
lib/                    → Shared server-side modules
public/                 → Static frontend (served at /)
  components/           → Reusable UI components (render functions returning HTML strings)
  lib/                  → Client-side utilities (router, API client, i18n, Supabase client)
  pages/                → Page render functions (one per route)
    admin/              → Admin page modules
scripts/                → SQL scripts (schema, seed, migrations — run in Supabase SQL Editor)
```

## Architecture

### Frontend (SPA)

- Single `public/index.html` shell with `<nav id="nav">`, `<main id="app">`, and `<div id="toast">`
- Hash-based SPA router (`public/lib/router.js`) — all routes use `#/path` format
- Each page is a JS module exporting an `async renderXxx()` function that writes into `#app` via `innerHTML`
- Supabase JS client loaded from CDN (`<script>` tag), then wrapped in `public/lib/supabase.js`
- `public/lib/api.js` — fetch wrapper that auto-attaches the Supabase JWT as `Authorization: Bearer <token>`
- `public/lib/i18n.js` — bilingual support (Spanish default / English toggle), translations stored in-file, language persisted via cookie `jivatma_lang`
- Auth guards in `app.js`: `requireAuth()` checks session, `requireAdmin()` checks session + profile role
- No build step — all JS is native ES modules loaded via `<script type="module">`

### Backend (Serverless API)

- Vercel serverless functions in `api/` — standard `export default function handler(req, res)` signature
- `vercel.json` routes: `/api/*` → serverless functions, `/*` → `public/`
- Server-side Supabase client (`lib/supabase.js`) uses service role key (bypasses RLS)
- Auth verification (`lib/auth.js`): extracts JWT from `Authorization` header, calls `supabase.auth.getUser()`, fetches profile
  - `verifyUser(req)` — returns `{ user, profile }` or `null`
  - `verifyAdmin(req)` — same but also checks `profile.role === 'admin'`
- Business logic modules: `lib/bookings.js` (booking validation), `lib/passes.js` (pass deduction/reversal)

### Data Flow

- Frontend reads/writes data directly via Supabase client (RLS enforces access control)
- Admin attendance endpoint (`api/admin/attendance`) called via `api()` fetch wrapper — this is the only admin action that goes through the serverless API (for pass deduction logic)
- Cron jobs run as serverless functions triggered by Vercel cron

## Database Schema

All tables live in Supabase (PostgreSQL). Schema defined in `scripts/schema.sql` and `scripts/setup-all.sql`.

### Tables

**`profiles`** — User profiles (extends Supabase `auth.users`)
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | References `auth.users(id)`, cascade delete |
| `full_name` | TEXT | Required |
| `phone` | TEXT | Optional |
| `role` | TEXT | `'admin'` or `'user'` (default `'user'`) |
| `created_at` | TIMESTAMPTZ | |

**`pass_types`** — Pass templates configured by admin
| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `kind` | TEXT | `'single'`, `'multi'`, or `'unlimited'` |
| `class_count` | INT | NULL for unlimited, 1 for single, N for multi |
| `validity_days` | INT | Days the pass is valid after purchase |
| `price` | NUMERIC(8,2) | In MXN |
| `currency` | TEXT | Default `'MXN'` |
| `is_active` | BOOLEAN | Soft delete |
| `created_at` | TIMESTAMPTZ | |

**`user_passes`** — Passes assigned to users
| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `user_id` | UUID FK | → `profiles(id)` |
| `pass_type_id` | INT FK | → `pass_types(id)` |
| `classes_remaining` | INT | NULL for unlimited, decremented on attendance |
| `starts_at` | DATE | |
| `expires_at` | DATE | |
| `payment_method` | TEXT | `'cash'`, `'transfer'`, or `'other'` |
| `is_paid` | BOOLEAN | |
| `created_by` | UUID FK | → `profiles(id)` (admin who assigned) |
| `created_at` | TIMESTAMPTZ | |

**`class_templates`** — Recurring weekly schedule slots
| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `day_of_week` | INT | 0=Sunday through 6=Saturday |
| `start_time` | TIME | |
| `duration_min` | INT | Default 60 |
| `class_type` | TEXT | `'online'`, `'in_person'`, or `'hybrid'` |
| `capacity` | INT | NULL = use default from settings |
| `is_active` | BOOLEAN | |
| `created_at` | TIMESTAMPTZ | |

**`class_sessions`** — Concrete class instances (generated from templates)
| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `template_id` | INT FK | → `class_templates(id)`, SET NULL on delete |
| `date` | DATE | |
| `start_time` | TIME | |
| `class_type` | TEXT | `'online'`, `'in_person'`, or `'hybrid'` |
| `capacity` | INT | |
| `status` | TEXT | `'scheduled'`, `'completed'`, or `'cancelled'` |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | |
| | | UNIQUE(`template_id`, `date`) |

**`pass_requests`** — Student pass requests (admin approves/rejects)
| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `user_id` | UUID FK | → `profiles(id)` |
| `pass_type_id` | INT FK | → `pass_types(id)` |
| `payment_method` | TEXT | `'transfer'`, `'cash'`, or `'other'` |
| `status` | TEXT | `'pending'`, `'approved'`, or `'rejected'` |
| `admin_notes` | TEXT | Optional admin note |
| `reviewed_by` | UUID FK | → `profiles(id)` (admin who reviewed) |
| `reviewed_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | |

**`bookings`** — Student sign-ups for sessions
| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `session_id` | INT FK | → `class_sessions(id)` |
| `user_id` | UUID FK | → `profiles(id)` |
| `booked_at` | TIMESTAMPTZ | |
| `cancelled_at` | TIMESTAMPTZ | Soft cancel (NULL = active) |
| | | UNIQUE(`session_id`, `user_id`) |

**`attendance`** — Check-in records (admin confirms who attended)
| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `session_id` | INT FK | → `class_sessions(id)` |
| `user_id` | UUID FK | → `profiles(id)` |
| `pass_id` | INT FK | → `user_passes(id)`, SET NULL on delete |
| `checked_in_at` | TIMESTAMPTZ | |
| | | UNIQUE(`session_id`, `user_id`) |

**`settings`** — Key-value configuration store
| Key | Purpose | Default |
|---|---|---|
| `location_address` | Studio address | `''` |
| `online_meeting_link` | Zoom/meet link for online classes | `''` |
| `signup_window_weeks` | How far ahead students can book | `'2'` |
| `default_capacity` | Default class capacity | `'15'` |

### Database Functions & Triggers

- `is_master_admin(email)` — Returns true for hardcoded master admin emails (`chaudy@gmail.com`, `jordi.vanvelzen@gmail.com`)
- `handle_new_user()` — Trigger on `auth.users` INSERT: auto-creates a `profiles` row; master admins get `role='admin'` automatically
- `protect_master_admin()` — Trigger on `profiles` UPDATE: prevents demoting master admins
- `is_admin()` — Helper for RLS policies: checks if `auth.uid()` has admin role

### Row Level Security (RLS)

All tables have RLS enabled. General pattern:
- Users can SELECT their own rows
- Users can INSERT/UPDATE their own bookings
- Admins have full access to all tables
- Authenticated users can read settings, active pass types, active templates, and sessions

## API Routes

All endpoints are Vercel serverless functions.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/schedule` | User | List upcoming sessions within sign-up window |
| GET | `/api/bookings` | User | List user's active bookings (with session data) |
| POST | `/api/bookings` | User | Book a session (`{ session_id }`) — validates capacity, window, duplicates |
| DELETE | `/api/bookings` | User | Cancel a booking (`{ session_id }`) — soft delete via `cancelled_at` |
| GET | `/api/me` | User | Get own profile (default), passes (`?action=passes`), attendance (`?action=attendance`), or requests (`?action=requests`) |
| PATCH | `/api/me` | User | Update own profile (`{ full_name, phone }`) |
| POST | `/api/me/request-pass` | User | Request any pass type (`{ pass_type_id, payment_method }`) — creates pending request for admin approval |
| POST | `/api/me/select-pass` | User | Self-select a single-class pass for cash payment (`{ pass_type_id }`) — creates unpaid pass immediately, pay at class |
| GET | `/api/admin/pass-requests` | Admin | List pending pass requests (optionally `?status=all`) |
| PATCH | `/api/admin/pass-requests` | Admin | Approve or reject a request (`{ id, action: 'approve'|'reject' }`) — approve creates `user_passes` entry |
| GET | `/api/admin/users` | Admin | List all user profiles |
| PATCH | `/api/admin/users` | Admin | Update any user profile (`{ id, ...updates }`) |
| GET | `/api/admin/passes` | Admin | List all user passes (optionally `?user_id=...`) |
| POST | `/api/admin/passes` | Admin | Assign a pass to a user (`{ user_id, pass_type_id, payment_method, is_paid }`) |
| GET | `/api/admin/passes?type=types` | Admin | List all pass types |
| POST | `/api/admin/passes?type=types` | Admin | Create a pass type |
| PATCH | `/api/admin/passes?type=types` | Admin | Update a pass type (`{ id, ...updates }`) |
| GET | `/api/admin/schedule` | Admin | List class templates |
| POST | `/api/admin/schedule` | Admin | Create a class template |
| DELETE | `/api/admin/schedule` | Admin | Delete a class template (`{ id }`) |
| GET | `/api/admin/schedule?type=sessions` | Admin | List class sessions (optionally `?date=YYYY-MM-DD`) |
| PATCH | `/api/admin/schedule?type=sessions` | Admin | Update a session (`{ id, ...updates }`) |
| GET | `/api/admin/settings` | Admin | Get all settings as key-value object |
| PATCH | `/api/admin/settings` | Admin | Upsert settings (`{ key: value, ... }`) |
| POST | `/api/admin/attendance` | Admin | Save attendance for a session (`{ session_id, user_ids }`) — auto-deducts passes, marks session completed |
| DELETE | `/api/admin/attendance` | Admin | Remove a single attendance record (`{ session_id, user_id }`) — reverses pass deduction |

## Cron Jobs

Configured in `vercel.json`:

| Schedule | Path | Description |
|---|---|---|
| `0 7 * * *` (daily 7AM UTC) | `/api/cron/generate-sessions` | Generates class sessions for the next 14 days from active templates (skips if session already exists for that template+date) |
| `0 8 * * *` (daily 8AM UTC) | `/api/cron/expire-passes` | Checks for passes expiring within 3 days and passes with 1-2 classes remaining. Currently logs counts only — notifications (email/WhatsApp) planned for V2 |

## Frontend Pages

### Public (no auth)

| Route | File | Description |
|---|---|---|
| `#/login` | `pages/login.js` | Email/password login form. Redirects to admin dashboard or user dashboard based on role |
| `#/register` | `pages/register.js` | Sign-up form (full name, email, password). Creates Supabase auth user + auto-creates profile via trigger |
| `#/forgot-password` | `pages/forgot-password.js` | Sends password reset email via Supabase |
| `#/reset-password` | `pages/reset-password.js` | New password form (reached from email link) |

### User (requires auth)

| Route | File | Description |
|---|---|---|
| `#/dashboard` | `pages/dashboard.js` | Home: active passes, upcoming bookings, recent attendance. New user onboarding guide (request a pass → book a class) |
| `#/schedule` | `pages/schedule.js` | Browse upcoming classes within sign-up window, book/cancel. Shows spots remaining, meeting link for online classes |
| `#/my-passes` | `pages/my-passes.js` | All passes (active, expired, used up) with status badges. Shows available pass types; students can request any pass (digital payment) or self-select single-class passes (pay cash at class). Shows pending/rejected requests |
| `#/my-attendance` | `pages/my-attendance.js` | Attendance history table (date, time, class type) |
| `#/profile` | `pages/profile.js` | Edit name/phone, change password |

### Admin (requires auth + admin role)

| Route | File | Description |
|---|---|---|
| `#/admin` | `pages/admin/index.js` | Dashboard: today's classes, pending pass requests count, expiring passes alerts, low-class-count alerts, quick action links |
| `#/admin/requests` | `pages/admin/pass-requests.js` | Pass request queue: view pending requests, approve (creates pass) or reject |
| `#/admin/class` | `pages/admin/class.js` | Attendance marking: date picker, session selector, checkbox list of booked students + walk-ins, saves via API |
| `#/admin/users` | `pages/admin/users.js` | User list table (name, role, view link) |
| `#/admin/users/:id` | `pages/admin/user-detail.js` | User detail: role toggle, assign pass form, pass history, recent attendance |
| `#/admin/passes` | `pages/admin/pass-types.js` | Manage pass types: list, activate/deactivate, add new |
| `#/admin/schedule` | `pages/admin/schedule.js` | Manage weekly templates: list, enable/disable, delete, add new. Manual session generation button |
| `#/admin/settings` | `pages/admin/settings.js` | Studio settings: location address, meeting link, sign-up window, default capacity |

## Components

| File | Export | Description |
|---|---|---|
| `components/nav.js` | `renderNav()` | Responsive navigation bar. Shows admin nav (dashboard, attendance, users, passes, schedule, settings) or user nav (home, classes, my passes, history). Includes language toggle and logout button. Hamburger menu on mobile |
| `components/class-card.js` | `renderClassCard(session, booking, spotsLeft)` | Card showing class date, time, type, spots remaining, and book/cancel button |
| `components/pass-card.js` | `renderPassCard(pass, passType)` | Card showing pass kind, classes remaining, expiry date, and status badge (active/expired/used up) |
| `components/toast.js` | `showToast(message, type)` | Fixed-position toast notification (success/error/info), auto-dismisses after 3s |

## Auth Flow

1. **Registration:** User submits name/email/password → `sb.auth.signUp()` → Supabase creates `auth.users` row → `handle_new_user()` trigger auto-creates `profiles` row (master admin emails get `role='admin'`)
2. **Login:** `sb.auth.signInWithPassword()` → Supabase returns JWT session → stored in browser by Supabase client → frontend checks profile role and redirects to `/admin` or `/dashboard`
3. **Session management:** Supabase JS client handles token storage and refresh automatically. `getSession()` returns current session or null
4. **API auth:** `public/lib/api.js` attaches `Authorization: Bearer <access_token>` to all API calls. Server-side `verifyUser()` validates JWT via `supabase.auth.getUser(token)` and fetches profile
5. **Password reset:** `sb.auth.resetPasswordForEmail()` sends email with link to `/#/reset-password` → `sb.auth.updateUser({ password })`
6. **Master admins:** Hardcoded emails are always assigned admin role on signup and cannot be demoted (protected by DB trigger)
7. **Frontend guards:** `requireAuth()` redirects to `/login` if no session. `requireAdmin()` additionally checks `profile.role === 'admin'` and redirects to `/dashboard` if not admin

## Internationalization (i18n)

- Two languages: Spanish (default) and English
- All UI strings use `t('key')` from `public/lib/i18n.js`
- Language toggle button on login page and in nav bar
- Persisted via cookie `jivatma_lang` (1 year expiry)
- Date formatting uses `getLocale()` → `es-ES` or `en-GB`

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `SUPABASE_URL` | Server (`.env`) | Supabase project URL |
| `SUPABASE_ANON_KEY` | Client (hardcoded in `public/lib/supabase.js`) | Supabase anon/public key (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server (`.env`) | Supabase service role key (bypasses RLS, server-only) |

## Development

```bash
npm install
npm run dev          # starts `vercel dev` on localhost
```

Requires a `.env` file with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (see `.env.example`).

Database setup: run `scripts/setup-all.sql` in the Supabase SQL Editor. This creates all tables, functions, triggers, RLS policies, and seed data in one shot.

## Deployment

- Hosted on Vercel, auto-deploys from `main` branch on GitHub
- `vercel.json` configures URL rewrites and cron schedules
- Environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) set in Vercel project settings
- No build step — Vercel serves `public/` as static files and `api/` as serverless functions

## Conventions

- ES modules everywhere — use `import`/`export`, not `require`
- One serverless function per file in `api/`
- Frontend is vanilla JS — no framework, no bundler, no build step
- Pages render into `#app` via `innerHTML` with template literals
- CSS in `public/style.css` — mobile-first, BEM-lite class naming
- All monetary values in MXN (Mexican Pesos, displayed as `$`)
- Dates handled as `YYYY-MM-DD` strings, times as `HH:MM` (from TIME columns)
- Spanish is the primary language; all user-facing strings go through `t()` for i18n

## Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| User Registration & Login | Built | Email/password via Supabase Auth with email confirmation |
| Master Admin Auto-Assignment | Built | Hardcoded emails get admin role on signup, cannot be demoted |
| Role-Based Access Control | Built | Two roles (admin/user) enforced via RLS and frontend guards |
| Class Schedule Templates | Built | Recurring weekly templates with day, time, type, capacity |
| Session Generation (Cron) | Built | Daily cron generates sessions for next 14 days, manual trigger available |
| Class Booking | Built | Book/cancel within configurable sign-up window, capacity enforcement, requires active pass |
| Pass Management | Built | Three types (single, multi, unlimited) with pricing in MXN and validity |
| Pass Request System | Built | Students request passes from My Passes page. Digital payments create pending requests for admin approval. Single-class cash passes are instant (unpaid, pay at class). Admin queue at `#/admin/requests` |
| Pass Assignment | Built | Admin assigns passes directly or approves requests. Payment method and paid status tracking |
| Attendance Tracking | Built | Admin marks attendance per session, auto-deducts from best active pass (FIFO) |
| Attendance Undo | Built | Removing attendance reverses pass deduction |
| Student Dashboard | Built | Active passes, upcoming bookings, recent attendance. New user onboarding guide |
| Admin Dashboard | Built | Today's classes, pending pass requests count, expiring pass alerts, low-class alerts, quick actions |
| New User Onboarding | Built | Dashboard shows step-by-step guide for new users: 1. Request a pass, 2. Book a class. Auto-hides once steps are complete, dismissible via localStorage |
| User Management | Built | View all users, user detail, toggle admin role, assign passes |
| Studio Settings | Built | Location, meeting link, sign-up window, default capacity |
| Bilingual UI (ES/EN) | Built | Full Spanish/English with toggle, persisted via cookie |
| View as Student Toggle | Built | Master admins can toggle between admin and student view via nav button. Student view shows their own real data (passes, bookings, attendance). Nav turns blue in student mode. In-memory state, resets on reload. Only visible to master admin emails. |
| Responsive Mobile-First UI | Built | Hamburger nav, card layouts, 800px max-width desktop |
| Profile Management | Built | Edit name/phone, change password |
| Online Class Support | Built | Three class types (online, in-person, hybrid) with meeting link |
| Pass Expiry Monitoring (Cron) | Built | Daily cron identifies expiring passes and low-remaining passes |
| Pass Expiry Notifications | Not Built | Email/WhatsApp notifications planned for V2 (placeholder in cron) |
| Payment Processing | Not Built | No online payments — passes assigned manually, payment tracked as cash/transfer/other |
| Waitlist | Not Built | No waitlist when classes are full — students see "Full" |

## Known Issues

_No known issues. Add issues here as they are discovered during development or testing._
