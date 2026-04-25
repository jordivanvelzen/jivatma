# Jivatma

## Supabase MCP
Two Supabase MCP servers are configured in this environment. Always use **`mcp__supabase__*`** (the plain one) for this project. The `mcp__supabase-kendama__*` server points to a different project (Kendama Senses) and must not be used here.

## Self-Maintenance
This file is the single source of truth for the Jivatma project. Every Claude Code session that changes the codebase MUST update this file to reflect the changes before finishing. This includes: adding new features to the feature list, updating the schema section if tables change, adding new API routes, updating the status of features, and noting any new known issues. When in doubt, update CLAUDE.md.

## Workflow — always deploy
There is no staging environment and no PR review step. The only branch is `main`. **After any code change, automatically commit to `main` and deploy to Vercel** — do not ask the user for permission first. The standard sequence at the end of a working session is:

1. `git add -A && git commit -m "<message>"` — concise message describing the change
2. `git push origin main` — triggers Vercel auto-deploy from GitHub
3. (Or, equivalently, `vercel --prod` to deploy directly without going through GitHub)

This applies to every code change unless the user explicitly says "don't deploy yet". Database migrations applied via the Supabase MCP are already live the moment they run, so always pair a deploy with the migration so frontend/backend code that depends on the new schema goes out together.

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
- Notification modules: `lib/telegram.js` (admin Telegram bot — supports test-mode rerouting to Jordi's chat), `lib/sms.js` (Twilio SMS to students — respects per-user `sms_opt_in` and test-mode rerouting to `jordi_test_phone`), `lib/notification-log.js` (fire-and-forget logger that writes to `notification_log` table — imported by both sms.js and telegram.js; callers pass `opts.eventType` and `opts.recipientName`)

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
| `show_in_attendance` | BOOLEAN | Default `TRUE`. When `FALSE`, the user is hidden from the admin attendance page's student list (both "booked" and "others" sections). Used to exclude teaching admins like Claudia from appearing as a checkable student. Users with an existing attendance record for a given session still appear for that session regardless of the flag, so past data stays editable |
| `sms_opt_in` | BOOLEAN | Default `TRUE`. When `FALSE`, `lib/sms.js` skips this user — pass-approval texts and expiry-reminder texts are not sent. Set on registration via a checkbox (defaults checked) and editable on the profile page |
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
| `payment_method` | TEXT | `'cash'`, `'transfer'`, `'other'`, or `'gift'` |
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
| `capacity` | INT | NULL = use default from settings (used for non-hybrid classes) |
| `capacity_inperson` | INT | Per-mode cap for hybrid classes — limit on `attendance_mode='in_person'` bookings |
| `capacity_online` | INT | Per-mode cap for hybrid classes — limit on `attendance_mode='online'` bookings |
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
| `capacity` | INT | Used for non-hybrid sessions |
| `capacity_inperson` | INT | Per-mode cap for hybrid sessions (in-person bookings) |
| `capacity_online` | INT | Per-mode cap for hybrid sessions (online bookings) |
| `status` | TEXT | `'scheduled'`, `'completed'`, or `'cancelled'` |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | |
| | | UNIQUE(`template_id`, `date`) |

**`bookings`** — Student sign-ups for sessions
| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `session_id` | INT FK | → `class_sessions(id)` |
| `user_id` | UUID FK | → `profiles(id)` |
| `booked_at` | TIMESTAMPTZ | |
| `cancelled_at` | TIMESTAMPTZ | Soft cancel (NULL = active) |
| `attendance_mode` | TEXT | NULL or `'online'` / `'in_person'`. For **hybrid** sessions the student picks how they will attend at sign-up time (modal). For online or in-person sessions this can also be set (auto-populated from the session's class_type). Used to show students/admin who is coming online vs at the studio |
| | | UNIQUE(`session_id`, `user_id`) |

**`attendance`** — Check-in records (admin confirms who attended)
| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `session_id` | INT FK | → `class_sessions(id)` |
| `user_id` | UUID FK | → `profiles(id)` |
| `pass_id` | INT FK | → `user_passes(id)`, SET NULL on delete |
| `checked_in_at` | TIMESTAMPTZ | |
| `attended` | BOOLEAN | Default `TRUE`. `FALSE` = no-show (still deducts a class). |
| | | UNIQUE(`session_id`, `user_id`) |

**`pass_requests`** — Student pass requests (pending admin approval)
| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `user_id` | UUID FK | → `profiles(id)` |
| `pass_type_id` | INT FK | → `pass_types(id)` |
| `status` | TEXT | `'pending'`, `'approved'`, or `'declined'` |
| `payment_method` | TEXT | `'cash'`, `'transfer'`, or `'other'` |
| `notes` | TEXT | Optional student notes |
| `telegram_message_id` | BIGINT | Message ID of the notification in admin's Telegram chat — used to edit the message in place when admin taps Approve/Decline inline |
| `decline_reason` | TEXT | Set during the multi-step decline flow when the admin types a reason in Telegram. Cleared on cancel. Persisted on the request after `status='declined'` so we have an audit trail of why each request was rejected |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**`settings`** — Key-value configuration store
| Key | Purpose | Default |
|---|---|---|
| `location_address` | Studio address | `''` |
| `online_meeting_link` | Zoom/meet link for online classes | `''` |
| `signup_window_weeks` | How far ahead students can book | `'2'` |
| `default_capacity` | Default class capacity | `'15'` |
| `bank_name` | Bank name for transfers | `''` |
| `bank_account_holder` | Account holder name | `''` |
| `bank_account_number` | Bank account number | `''` |
| `bank_clabe` | CLABE (Mexican interbank number) | `''` |
| `bank_card_number` | Card number | `''` |
| `payment_instructions` | Extra free-form payment instructions | `''` |
| `telegram_bot_token` | Telegram bot token (from @BotFather) | `''` |
| `telegram_chat_id` | Telegram chat ID to notify on new pass requests | `''` |
| `telegram_webhook_secret` | Secret token Telegram includes in the `X-Telegram-Bot-Api-Secret-Token` header on every webhook call. Generated when admin taps "Activar botones" | `''` |
| `test_mode` | `'true'` routes all Telegram messages to `jordi_telegram_chat_id` (with a `[TEST]` prefix) and reroutes all SMS sends to `jordi_test_phone`. Toggled via radio on admin settings page ("Destinatario activo: Claudia / Jordi") | `'true'` |
| `jordi_telegram_chat_id` | Jordi's personal Telegram chat_id, used as the destination when `test_mode='true'` | `''` |
| `jordi_test_phone` | Jordi's phone in E.164 (e.g. `+525578923883`), used as the destination for SMS when `test_mode='true'` | `''` |
| `wa_template_approved` | WhatsApp message template sent when a pass request is approved. Placeholders: `{name}`, `{kind}`. Editable from admin settings → "Plantillas de WhatsApp". Falls back to the hardcoded default in `lib/telegram.js` when blank | `''` |
| `wa_template_declined` | WhatsApp template for pass-request decline. Placeholders: `{name}`, `{reason}` | `''` |
| `wa_template_expiring` | WhatsApp template for the daily "your pass expires today" nudge. Placeholders: `{name}`, `{kind}` | `''` |
| `wa_template_last_class` | WhatsApp template for the "last class used" nudge. Placeholders: `{name}`, `{kind}` | `''` |

**`sms_log`** — Throttle log so the daily expiry cron doesn't spam students with the same nudge twice
| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `user_pass_id` | INT FK | → `user_passes(id)` ON DELETE CASCADE |
| `kind` | TEXT | `'expiring'` or `'low_classes'` (one row per pass per kind = sent at most once) |
| `sent_at` | TIMESTAMPTZ | Default `now()` |

**`notification_log`** — Audit log of every outgoing SMS and Telegram message
| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `channel` | TEXT | `'sms'` or `'telegram'` |
| `event_type` | TEXT | `'pass_request'`, `'pass_approved'`, `'pass_declined'`, `'expiry_reminder'`, `'low_classes'`, `'stale_unpaid'`, `'test'` |
| `recipient_name` | TEXT | Student name or `'Admin'` |
| `recipient_phone` | TEXT | E.164 phone, SMS only |
| `message_preview` | TEXT | First 300 chars of the message body |
| `status` | TEXT | `'sent'`, `'failed'`, `'opted_out'`, `'not_configured'`, `'test_phone_not_set'`, `'invalid_phone'`, `'skipped'` |
| `error_detail` | TEXT | Truncated error from Twilio or Telegram when status is `'failed'` |
| `test_mode` | BOOLEAN | Whether test_mode was active at send time |
| `created_at` | TIMESTAMPTZ | Default `now()` |

### Database Functions & Triggers

- `is_master_admin(email)` — Returns true for hardcoded master admin emails (`chaudy@gmail.com`, `jordi.vanvelzen@gmail.com`)
- `handle_new_user()` — Trigger on `auth.users` INSERT: auto-creates a `profiles` row (including `phone` and `sms_opt_in` from signup metadata; defaults `sms_opt_in=TRUE` when not provided); master admins get `role='admin'` automatically
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
| POST | `/api/bookings` | User | Book a session (`{ session_id, attendance_mode? }`) — `attendance_mode` is `'online'` or `'in_person'`, required UX-wise for hybrid sessions (the SPA opens a picker modal). The frontend writes directly to Supabase rather than going through this endpoint, but the API accepts the same shape |
| DELETE | `/api/bookings` | User | Cancel a booking (`{ session_id }`) — soft delete via `cancelled_at` |
| GET | `/api/me` | User | Get own profile (default), passes (`?action=passes`), or attendance (`?action=attendance`) |
| PATCH | `/api/me` | User | Update own profile (`{ full_name, phone }`) |
| POST | `/api/me/select-pass` | User | Self-select a single-class pass (`{ pass_type_id }`) — creates unpaid pass, pay at class |
| GET | `/api/admin/users` | Admin | List all user profiles |
| PATCH | `/api/admin/users` | Admin | Update any user profile (`{ id, ...updates }`) |
| GET | `/api/admin/passes` | Admin | List all user passes (optionally `?user_id=...`) |
| POST | `/api/admin/passes` | Admin | Assign a pass to a user (`{ user_id, pass_type_id, payment_method, is_paid }`). `payment_method='gift'` auto-sets `is_paid=true` |
| PATCH | `/api/admin/passes` | Admin | Edit an issued user_pass (`{ id, expires_at?, classes_remaining?, is_paid?, payment_method?, starts_at? }`) |
| PUT | `/api/admin/passes` | Admin | Credit-back or extend a pass (`{ id, action: 'credit' \| 'extend', days? }`) |
| DELETE | `/api/admin/passes` | Admin | Delete an issued user_pass (`{ id }`) |
| GET | `/api/admin/passes?type=types` | Admin | List all pass types |
| POST | `/api/admin/passes?type=types` | Admin | Create a pass type |
| PATCH | `/api/admin/passes?type=types` | Admin | Update a pass type (`{ id, ...updates }`) |
| GET | `/api/admin/schedule` | Admin | List class templates |
| POST | `/api/admin/schedule` | Admin | Create a class template |
| PATCH | `/api/admin/schedule` | Admin | Update a class template (`{ id, ...updates }`) |
| DELETE | `/api/admin/schedule` | Admin | Delete a class template (`{ id }`) |
| GET | `/api/admin/schedule?type=sessions` | Admin | List class sessions (optionally `?date=YYYY-MM-DD`) |
| POST | `/api/admin/schedule?type=sessions` | Admin | Create a one-off session (`{ date, start_time, class_type, capacity?, notes? }`) |
| PATCH | `/api/admin/schedule?type=sessions` | Admin | Update a session (`{ id, ...updates }`) |
| DELETE | `/api/admin/schedule?type=sessions` | Admin | Delete a session (`{ id }`) |
| GET | `/api/admin/settings` | Admin | Get all settings as key-value object |
| PATCH | `/api/admin/settings` | Admin | Upsert settings (`{ key: value, ... }`) |
| POST | `/api/admin/attendance` | Admin | Save attendance for a session (`{ session_id, records: [{user_id, attended}] }`) — auto-deducts passes (no-shows still deduct), marks session completed. Accepts legacy `user_ids` array (all treated as attended). |
| DELETE | `/api/admin/attendance` | Admin | Remove a single attendance record (`{ session_id, user_id }`) — reverses pass deduction |
| POST | `/api/admin/settings` | Admin | Admin actions. Body `{ action: 'telegram-test' }` sends a test Telegram message using current settings. |
| GET | `/api/pass-requests` | User | List pass requests (admin sees all, user sees own) |
| POST | `/api/pass-requests` | User | Create a pass request (`{ pass_type_id, payment_method, notes }`) |
| PATCH | `/api/pass-requests` | Admin | Approve/decline a request (`{ id, status }`) — auto-creates user_pass on approve; also edits the original Telegram message in place |
| POST | `/api/pass-requests?webhook=telegram` | Telegram (secret header) | Telegram webhook for inline Approve/Decline buttons. Validates `X-Telegram-Bot-Api-Secret-Token` against `telegram_webhook_secret`. Processes `callback_query` updates, runs approve/decline, edits the message, answers the callback |
| POST | `/api/admin/settings` `{ action: 'register-webhook' }` | Admin | Generates a fresh `telegram_webhook_secret`, persists it, and calls Telegram `setWebhook` pointing at `/api/pass-requests?webhook=telegram`. Run once per bot-token change |
| GET | `/api/admin/notifications` | Admin | List notification_log rows. Accepts `?limit`, `?offset`, `?channel`, `?event_type`, `?status` filters. Returns `{ rows, total }` |
| POST | `/api/admin/settings` `{ action: 'sms-test', to? }` | Admin | Sends a test SMS via Twilio. In `test_mode='true'`, reroutes to `jordi_test_phone` automatically. In production mode, requires explicit `to` in body (E.164) so we never accidentally text a real student |
| GET | `/api/admin/settings?type=notifications` | Admin | List rows from `notification_log` (paginated, filterable by `channel`, `event_type`, `status`, `limit`, `offset`). Folded into the settings endpoint to stay under the Vercel Hobby 12-function limit |

## Cron Jobs

Configured in `vercel.json`:

| Schedule | Path | Description |
|---|---|---|
| `0 7 * * *` (daily 7AM UTC) | `/api/cron/generate-sessions` | Generates class sessions for the next 14 days from active templates (skips if session already exists for that template+date) |
| `0 8 * * *` (daily 8AM UTC) | `/api/cron/expire-passes` | (1) Telegram digest to admin listing passes expiring **today** — each entry has a pre-filled WhatsApp deeplink so Claudia can notify the student; (2) Telegram digest listing stale unpaid passes (>3 days old, still `is_paid=false`, still active). No SMS sent. |

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
| `#/dashboard` | `pages/dashboard.js` | Home: active passes, pending pass requests awaiting admin verification, upcoming bookings, recent attendance |
| `#/schedule` | `pages/schedule.js` | Browse upcoming classes within sign-up window, book/cancel. Shows spots remaining, meeting link for online classes |
| `#/my-passes` | `pages/my-passes.js` | All passes (active, expired, used up) with status badges. Shows available pass types; students can self-select single-class passes (pay at class) |
| `#/my-attendance` | `pages/my-attendance.js` | Attendance history table (date, time, class type) |
| `#/profile` | `pages/profile.js` | Edit name/phone, change password |

### Admin (requires auth + admin role)

| Route | File | Description |
|---|---|---|
| `#/admin` | `pages/admin/index.js` | Dashboard: today's classes, expiring passes alerts, low-class-count alerts, quick action links |
| `#/admin/class` | `pages/admin/class.js` | Attendance marking: date picker, session selector, checkbox list of booked students + walk-ins, saves via API |
| `#/admin/users` | `pages/admin/users.js` | User list table (name, role, view link) |
| `#/admin/users/:id` | `pages/admin/user-detail.js` | User detail: role toggle, assign pass form, pass history, recent attendance |
| `#/admin/passes` | `pages/admin/pass-types.js` | Manage pass types (collapsed cards, tap to expand and edit inline — fields stack vertically on very narrow screens), Active Passes overview (all issued passes with student name / type / classes-left / expiry countdown, filter chips: all / unpaid / expiring), and pass requests |
| `#/admin/schedule` | `pages/admin/schedule.js` | Manage weekly templates: list, enable/disable, delete, add new. Manual session generation button |
| `#/admin/settings` | `pages/admin/settings.js` | Studio settings: location address, meeting link, sign-up window, default capacity |
| `#/admin/notifications` | `pages/admin/notifications.js` | Notification history: paginated log of all SMS and Telegram sends with channel, event type, recipient, status, message preview. Filterable by channel and event type |

## Components

| File | Export | Description |
|---|---|---|
| `components/nav.js` | `renderNav()` | Responsive navigation. Top bar (sticky) is rendered for both views; on mobile it shows brand + view-pill (master admin) + lang/logout icons (admin also has a hamburger for the dropdown of Schedule/Settings). On mobile (<768px) every authenticated screen also gets a fixed 4-tab bottom-nav: **Student** = Inicio / Clases / Mis Pases / Perfil, **Admin** = Panel / Asistencia / Usuarios / Pases. Bottom-nav is hidden ≥768px (top-nav links are the desktop UI). Body gets `has-bottom-nav` so layout reserves space and toast positioning shifts above the bar |
| `components/class-card.js` | `renderClassCard(session, booking, spotsLeft, hasActivePass)` | Redesigned card: calendar-block date on the left (DOW / day / month), big time + custom-SVG class-type badge in the body, spots count with people icon, and an action area (sign-up button or booked pill + cancel). Hybrid bookings show a chosen-mode pill ("In-person" / "Online") next to the booked pill. The sign-up button on hybrid classes carries `js-signup-hybrid` so the schedule page knows to open the mode-picker modal |
| `lib/icons.js` | `icon(name, opts)` / `classTypeIcon(type)` | Custom SVG icon set. All icons are 24×24 stroke-based, inherit `currentColor`, and replace what would otherwise be standard emojis. Includes class-type icons (in_person, online, hybrid), nav icons (classes, passes, more, home, history, profile, lang, logout), view-toggle icons (admin/student shields), brand mark (lotus), and status icons (check, x, clock, spots, alert, arrow_right) |
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
| `TWILIO_ACCOUNT_SID` | Server (Vercel env) | Twilio account SID for SMS (starts with `AC`) |
| `TWILIO_AUTH_TOKEN` | Server (Vercel env) | Twilio auth token (32 hex) — used by `lib/sms.js` for HTTP basic auth |
| `TWILIO_FROM_NUMBER` | Server (Vercel env) | Twilio sender phone in E.164 (e.g. `+19786257620`) |
| `DEFAULT_COUNTRY_CODE` | Server (Vercel env) | Country code prepended when normalizing student phones without `+` (e.g. `52` for Mexico, `57` for Colombia) |

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
- CSS in `public/style.css` — mobile-first (320px+), BEM-lite class naming. Uses CSS custom properties for design tokens: colors (`--green-700`, `--ink-900`, `--cream-50`, `--amber-bg`, etc.), spacing (`--s-1` through `--s-10`), radii (`--r-sm/md/lg/pill`), elevation (`--sh-1/2/3`), motion (`--ease`, `--t-fast/med`). Legacy aliases (`--green`, `--gray`, `--gray-dark`, etc.) are preserved so older inline styles keep working. Buttons have a 44px min tap target; safe-area insets handled via `env(safe-area-inset-bottom)`
- All monetary values in MXN (Mexican Peso), displayed as "$X.XX MXN"
- Dates handled as `YYYY-MM-DD` strings, times as `HH:MM` (from TIME columns)
- Spanish is the primary language; all user-facing strings go through `t()` for i18n

## Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| User Registration & Login | Built | Email/password via Supabase Auth with email confirmation |
| Master Admin Auto-Assignment | Built | Hardcoded emails get admin role on signup, cannot be demoted |
| Role-Based Access Control | Built | Two roles (admin/user) enforced via RLS and frontend guards |
| Class Schedule Templates | Built | Recurring weekly templates with day, time, type, capacity. Admin schedule page renders templates as collapsed cards (title `Day · HH:MM`, meta `type · capacity summary`, active/inactive badge). Tap to expand → stacked editable fields (day/time/type/capacity, per-mode pair shown for hybrid) plus Save / Disable / Delete actions. Upcoming sessions list rebuilt as compact `session-row` cards instead of a wide table so both sections read well on 320px-wide phones |
| One-off Sessions | Built | Admin can add ad-hoc class sessions not tied to a template (e.g. special workshops). Appears in upcoming sessions list and can be deleted individually |
| Session Generation (Cron) | Built | Daily cron generates sessions for next 14 days, manual trigger available |
| Delete Sessions | Built | Admin can delete individual upcoming sessions from the schedule page |
| Class Booking | Built | Book/cancel within configurable sign-up window, capacity enforcement, requires active pass. Single-class passes can be self-selected (pay at class); multi/unlimited passes must be assigned by admin |
| Hybrid Attendance Mode | Built | When a student signs up for a hybrid class, a mode-picker modal opens with two large card-buttons ("In-person — at the studio" / "Online — join via Zoom"). Choice is stored in `bookings.attendance_mode`. The booked pill on the class card surfaces it, the dashboard upcoming list appends it, and the admin attendance page shows a small mode pill next to each booked student. Online and in-person sessions auto-fill the mode without a picker |
| Per-Mode Capacity (hybrid) | Built | Hybrid classes now have separate `capacity_inperson` and `capacity_online` limits on both `class_templates` and `class_sessions`. Admin schedule UI shows two capacity inputs when class type is hybrid (one for non-hybrid). Class card displays per-mode spot counts side by side. The hybrid mode-picker modal shows remaining spots per mode and disables a mode when its limit is reached. The class is only marked "full" when every mode with a cap is full. Server-side `canBook` enforces per-mode caps using `attendance_mode`. Non-hybrid sessions continue to use the single `capacity` column |
| Visual Refresh & Bottom Nav | Built | Mobile-first design system using CSS custom-property tokens (deep forest sage brand, warm honey accent, cream-bone background). Custom SVG icon set in `lib/icons.js` replaces standard emojis. Class card redesigned with a calendar-block date and custom type badge. Master-admin view switcher is a segmented `[Admin \| Student]` pill. Both views get a fixed mobile bottom-nav with 4 tabs each — **Student:** Inicio / Clases / Mis Pases / Perfil, **Admin:** Panel / Asistencia / Usuarios / Pases. Schedule and Settings live in the admin top-bar dropdown (hamburger remains on admin mobile) |
| Master Admin View Toggle | Built | Master admins (`chaudy@gmail.com`, `jordi.vanvelzen@gmail.com`) get a segmented `[Admin \| Student]` pill in the top bar. Tapping the inactive side flips view mode and navigates to that view's home (`/admin` ↔ `/dashboard`). State persists in `sessionStorage` (`jivatma_student_view`) so it survives reloads within the session and resets on logout/new tab. `requireAdmin` redirects to `/dashboard` when student view is active, so admin-only URLs auto-bounce when toggled |
| Pass Management | Built | Three types (single, multi, unlimited) with pricing and validity. Pass types can be edited inline (price/classes/days) by admin |
| Stackable Single-Class Passes | Built | Students can self-select multiple single-class passes; each valid for 30 days. FIFO deduction (oldest-expiring first) |
| Pass Assignment | Built | Admin assigns passes with payment method (cash/transfer/other/gift) and paid status tracking. Gift passes auto-mark as paid |
| Edit Issued Passes | Built | Admin can edit any issued user_pass: classes remaining, expiry date, paid status. Also one-click `+1 class` (credit-back) or `+7 days` (extend), plus delete |
| Attendance Tracking | Built | Admin marks attendance per session with three states per student (✓ attended / ✗ no-show / — unmarked). Both ✓ and ✗ deduct from the best active pass (FIFO); no-shows are tagged via the `attended` boolean so stats remain accurate. Unmarked students are left as no-row. |
| Admin Attendance Visibility Toggle | Built | Each profile has a `show_in_attendance` flag (default `TRUE`). On the admin user-detail page, a checkbox appears for admin profiles letting you hide that admin from the attendance page's student list. Lets Claudia (teacher admin) disappear from attendance while Jordi (admin + student) stays visible. Users with existing attendance for a session still appear on that session so past records remain editable |
| Student Onboarding | Built | Register page requires phone (WhatsApp) and explains the email-verification → login → get-pass flow up front. Dashboard shows a welcome card with 3 steps (get pass → book → attend) for brand-new students (no passes + no bookings + no attendance), then auto-hides. Empty states on dashboard include CTA buttons. |
| Approval WhatsApp Nudge | Built | When Claudia approves a pass request, she receives a Telegram message with a `wa.me/<phone>?text=...` tap-to-WhatsApp link pre-filled with a "tu pase está aprobado" message for the student. Mexico country code (52) auto-prepended to bare 10-digit phones. |
| Attendance Undo | Built | Removing attendance reverses pass deduction |
| Student Dashboard | Built | Active passes, upcoming bookings, recent attendance |
| Admin Dashboard | Built | Today's classes, expiring pass alerts, low-class alerts, quick actions |
| User Management | Built | View all users, user detail, toggle admin role, assign passes |
| Studio Settings | Built | Location, meeting link, sign-up window, default capacity |
| Bilingual UI (ES/EN) | Built | Full Spanish/English with toggle, persisted via cookie |
| View as Student Toggle | Built | Master admins can toggle between admin and student view via the segmented pill in the nav. Student view shows their own real data (passes, bookings, attendance). Nav turns blue in student mode. State persists in `sessionStorage` so it survives reloads within the session, resets on logout. Only visible to master admin emails. |
| Responsive Mobile-First UI | Built | Hamburger nav, card layouts, 800px max-width desktop |
| Profile Management | Built | Edit name/phone, change password |
| Online Class Support | Built | Three class types (online, in-person, hybrid) with meeting link |
| Pass Expiry Monitoring (Cron) | Built | Daily cron identifies expiring passes and low-remaining passes |
| Pass Requests | Built | Students can request passes from the passes page. Shows available pass types with MXN prices, request button opens modal with payment method and notes. Modal shows studio bank details (holder/bank/account/CLABE/card) configured in admin settings — clicking a value copies it. Student can check "I've made the payment" which prepends `[PAID]` to notes. Students see their request history with status badges. Pending requests also surface on the student dashboard as a yellow-bordered "waiting for Claudia to verify" card, so students get immediate feedback after submitting. Admins see pending requests on the pass types page with approve/decline buttons. Approving auto-creates the user_pass assignment and marks it `is_paid=true` — approval is Claudia's confirmation that payment has been verified (transfer) or collected (cash). For cash the expected workflow is: student brings cash to the studio → Claudia collects → Claudia taps Approve. |
| Payment Instructions | Built | Admin configures bank details (holder, bank name, account, CLABE, card number, free-form instructions) in settings. Shown to students in pass-request modal with copy-on-click |
| Icon Nav | Built | Logout, language, profile are icon-only buttons grouped on the right side of the nav. Main section links remain in the collapsible list. Language button shows the *other* language code (ES/EN) |
| SMS to Students (Twilio) | Removed | SMS has been replaced by WhatsApp deeplinks for all student-facing notifications. Twilio SMS is no longer triggered from the app. `lib/sms.js` still exists but is no longer called. The `sms_log` table still exists but is unused. |
| SMS Opt-in | Built | `profiles.sms_opt_in` defaults to `TRUE`. Checkbox on registration (defaults checked, with text "Recibir notificaciones por SMS"). Toggle on profile page. Trigger `handle_new_user()` reads `sms_opt_in` from signup metadata. The SMS lib short-circuits with `reason: 'opted_out'` when the flag is false (admin-only sends bypass via `bypassOptIn: true`) |
| Test-Mode Routing | Built | A single `test_mode` setting (toggleable from admin settings page as a segmented pill between "👩‍🦰 Claudia (producción)" and "🧪 Jordi (pruebas)" — saves on click, no separate Save button) reroutes ALL outgoing notifications. When on: Telegram messages go to `jordi_telegram_chat_id` with a `🧪 [TEST]` prefix; SMS go to `jordi_test_phone` with a `[TEST]` prefix. Lets Jordi safely test approval flow / cron without spamming Claudia or real students. Bot token, chat IDs, Twilio test phone, and the SMS/Telegram test buttons are no longer exposed in the UI — they're set in DB once and left alone. Re-register the Telegram webhook by running the `register-webhook` settings POST manually if the bot token ever changes |
| Editable WhatsApp Templates | Built | Admin can edit the four WhatsApp message templates from settings → "Plantillas de WhatsApp" (approved / declined / expiring today / last class used). Templates support `{name}`, `{kind}`, `{reason}` placeholders, are persisted in `settings` table (`wa_template_*` keys), and read at send time via `getWaTemplate()` in `lib/telegram.js`. Section has its own Save button and a "Restaurar predeterminados" button that resets the textareas to the in-code defaults (admin still has to Save) |
| Settings Sectioning | Built | Admin settings page rebuilt with collapsible `<details>` sections (Estudio / Plantillas WhatsApp / Datos bancarios) plus an always-visible recipient toggle (segmented pill) at the top. Each section has its own Save button so changes are scoped. Bot token, chat IDs, Twilio test phone, and the test/webhook/SMS-test buttons are hidden — those values are configured once in the DB and the UI no longer displays them |
| Admin Notifications (new pass request) | Built | Telegram notification fires on every new `pass_requests` insert. Message is branched by payment method: transfer shows `⚠️ verify in bank before approving`, cash shows `💵 collect at studio before approving`. Each message has inline `✅ Aprobar` / `❌ Rechazar` buttons. **Approve** flow: admin taps once → request approved + pass created as paid + original message edited to show `✅ Pase aprobado` + a pre-filled `💬 Avisar por WhatsApp` deeplink so Claudia can notify the student. **Decline** flow is multi-step: tap `❌ Rechazar` → bot replies with a `force_reply` prompt asking for the motivo → admin types the reason → bot replies with a preview + pre-filled WhatsApp deeplink + `✅ Confirmar rechazo` / `❌ Cancelar` buttons → on confirm the request is marked declined and the original notification is edited to `❌ Solicitud rechazada` with the motivo + WhatsApp link. No SMS is sent at any point — all student communication goes through WhatsApp. Requires one-time "Activar botones" in admin settings to register the Telegram webhook (`allowed_updates=['callback_query','message']` so the reply step works). Legacy PATCH path (approve/decline from web UI) still works and also edits the Telegram message |
| Cash-Pending Attendance UX | Built | On attendance page, students with an unpaid active pass (e.g. a manually-assigned pass left unpaid, or a self-selected single-class pass) show a `💵 cobrar $X` badge next to their name + a one-tap "Marcar pagado" button. After saving attendance, any checked-in student who still had an unpaid pass triggers a second toast listing names + amounts to collect. Approved pass requests are always marked paid and never trigger this. |
| Stale Cash Nudge (cron) | Built | Daily `expire-passes` cron scans `user_passes` where `is_paid=false`, `created_at > 3 days ago`, still active. Sends digest to Telegram listing who owes what. Catches self-selected single-class passes or manually-assigned unpaid passes that never got collected |
| Student Cash Instruction | Built | When a student selects "Efectivo" in the pass-request modal, a yellow notice replaces the bank-details block: *"Por favor trae el efectivo a tu próxima clase. Llega 10 minutos antes para pagar en el estudio antes de empezar."* System-driven so Claudia doesn't have to ask for money |
| Users List Pass Summary | Built | Admin users list shows each user's best active pass at a glance: *"Unlimited Monthly · Vence 15 May"* or *"10-Class Pass · 7 restan · Vence 30 May"*. Unpaid passes carry a `💵` badge. Clicking the row opens user detail |
| Pass-Types Mobile Cards | Built | Admin pass-types page rewritten from a cramped table to a card-per-type layout with inline editable fields (classes, validity days, price). Active/inactive badge on each card. Add form folded into a collapsible section |
| Pass-Types Collapsed Editor | Built | Each pass type is collapsed by default (title · summary "N clases / M días / $price" · active badge); tap to expand and edit inline. Fields stack vertically on phones ≤419px so inputs never overflow the card (tested at 320px); 2-column grid at 420–599px; 3-column at 600px+. Unlimited passes show a disabled `∞` for class count |
| Admin Active Passes Overview | Built | On `#/admin/passes` a dedicated "Active Passes" section lists every issued pass that is not expired and still has classes remaining, sorted by soonest expiry. Each card shows student name, pass type, classes-left (or ∞), relative expiry ("vence en N días" / hoy / mañana) + date, and a `💵 cobrar` badge if unpaid. Unpaid / expiring (≤7 days) rows get a colored left border. Filter chips above the list: All / 💵 Por cobrar / ⚠️ Por vencer. Clicking a card opens the user detail page (where the pass can be edited) |
| Request History View-Pass | Built | Processed pass requests on admin passes page now show a "Ver pase" link that opens the student's user-detail page (where the full pass editor lives) |
| Notification History | Built | `notification_log` table captures every outgoing SMS and Telegram send: channel, event type, recipient, status (`sent`/`failed`/`opted_out`/etc.), message preview (300 chars), test_mode flag, and error detail on failure. `lib/notification-log.js` is a fire-and-forget logger imported by `lib/sms.js` and `lib/telegram.js`. Viewable at `#/admin/notifications` with channel + event-type filters and pagination. The admin bottom nav's 5th "Ajustes" tab (gear icon) covers Settings, Schedule, and Notifications |
| Payment Processing | Not Built | No online payments — passes assigned manually, payment tracked as cash/transfer/other |
| Waitlist | Not Built | No waitlist when classes are full — students see "Full" |

## Known Issues

_No known issues. Add issues here as they are discovered during development or testing._
