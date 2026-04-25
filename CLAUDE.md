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
- History-API SPA router (`public/lib/router.js`) — clean URLs like `/dashboard`, `/admin/users/abc`. `vercel.json` rewrites every non-`/api`/non-asset path to `/public/index.html` so deep links and refresh work. The router intercepts clicks on internal `<a href="/...">` links and calls `history.pushState` instead of doing a full reload. Use `navigate('/path')` to programmatically change route, `replace('/path')` for redirects, and `rerender()` to re-render the current route without changing the URL (used by language toggle and view-pill)
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
| `cancellation_reason` | TEXT | Free-form reason shown to students on the schedule and on the admin upcoming-sessions list. Set by both the cron (e.g. unavailability reason or `'Teacher unavailable'`) and by manual cancels (defaults to `'Cancelada'` or whatever the admin types in the prompt). |
| `auto_cancelled` | BOOLEAN | `TRUE` only when the cron cancelled the session because its date fell inside an `unavailability` window. Manual cancels set `FALSE`. The cron's auto-restore rule (when an unavailability window is removed) only re-opens rows with `auto_cancelled=TRUE`, so admin-cancelled sessions stay cancelled across cron runs. |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | |
| | | UNIQUE(`template_id`, `date`) |

**`unavailability`** — Date ranges when no classes are held (vacation, retreats, holidays). Closed range `[start_date, end_date]`. The generate-sessions cron auto-cancels sessions on these dates instead of deleting them, so students see "class cancelled" on the schedule rather than the slot disappearing.
| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `start_date` | DATE | |
| `end_date` | DATE | CHECK `end_date >= start_date` |
| `reason` | TEXT | Optional, surfaced to students as the cancellation reason |
| `created_at` | TIMESTAMPTZ | |

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
| `wa_template_welcome` | WhatsApp template sent (as a deeplink in the Telegram new-signup notification) when a new student registers. Placeholders: `{name}` | `''` |
| `wa_template_class_cancelled` | WhatsApp template used when notifying students of a cancelled class. Placeholders: `{name}`, `{date}`, `{time}`, `{reason}` (note: `{reason}` is rendered as `" por <reason>"` or empty — the leading space is included). Editable in admin settings → "Plantillas de WhatsApp" → "Clase cancelada". Falls back to the in-code default | `''` |
| `extend_nudge_last_sent` | Studio-TZ `YYYY-MM-DD` of the last time the bi-weekly schedule-extend Telegram nudge was sent. Used to enforce the every-other-Monday cadence. Auto-updated by the cron when a nudge is sent | `''` |
| `claudia_can_generate_sessions` | `'true'` (default) shows the "Generate & Sync" section on the admin schedule page to all admins. `'false'` hides it from Claudia (non-super-admin admins). Jordi always sees it regardless of this setting. Toggled from the "Permisos de Admin" section in settings (super-admin only) | `'true'` |
| `cc_super_admin` | `'true'` makes every production Telegram message Claudia receives also fire-and-forget a CC copy to `jordi_telegram_chat_id` in **English** (the message text + neutered buttons whose `callback_data` is prefixed with `cc_noop:` so taps just toast "CC copy — actions go to Claudia"). Additionally, after Claudia clicks an inline button, an `📌 [Event]` notification is sent to Jordi summarizing what she did (e.g. "✅ Claudia approved Maria's pass request"). Toggleable on the settings page **only when the logged-in user's email is in the hardcoded `SUPER_ADMIN_EMAILS` list** in `public/lib/super-admin.js` (currently `jordi.vanvelzen@gmail.com` and `dev.jordi@pm.me`). When `test_mode='true'` the CC is suppressed because Jordi is already the primary recipient | `'false'` |

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
| POST | `/api/me?action=notify-signup` | User | Fires a Telegram "new registration" notification to admin (with WhatsApp deeplink using `wa_template_welcome`). Idempotent — skipped if a `new_signup` log row for this email already exists. Called fire-and-forget from the register page right after `signUp` succeeds (only fires when email confirmation is off, since otherwise the new user has no session yet) |
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
| GET | `/api/admin/schedule?type=unavailability` | Admin | List unavailability windows (sorted by `start_date` asc) |
| POST | `/api/admin/schedule?type=unavailability` | Admin | Create an unavailability window (`{ start_date, end_date, reason? }`). The admin UI auto-runs the generate cron right after so cancellations propagate immediately to existing future sessions |
| DELETE | `/api/admin/schedule?type=unavailability` | Admin | Delete an unavailability window (`{ id }`). The admin UI auto-runs the generate cron after so previously auto-cancelled sessions get restored |
| POST | `/api/admin/schedule?action=resync` | Admin | Resync future scheduled sessions to their template: copies `start_time`, `class_type`, `capacity`, `capacity_inperson`, `capacity_online` from the template onto every future scheduled session whose `template_id` matches. Returns `{ updated, withBookings: [{session_id, bookings}], errors }` so admin can see which updated sessions had active bookings (and may need a heads-up to students). One-off sessions (`template_id=null`) are skipped |
| POST | `/api/admin/schedule?action=cancel-session` | Admin | Manually cancel one session (`{ id, reason? }`). Sets `status='cancelled'`, `cancellation_reason=reason||'Cancelada'`, `auto_cancelled=false`. Then calls `notifySessionsCancelled([id])` which sends one Telegram message per cancelled session (only when there are still-active bookings) listing each affected student with a pre-filled WhatsApp deeplink. Returns `{ session, notify: { sent } }` |
| POST | `/api/admin/schedule?action=uncancel-session` | Admin | Re-open a previously (manually) cancelled session (`{ id }`). Clears `cancellation_reason` and sets `status='scheduled'`. Auto-cancelled sessions should be reopened by removing the underlying unavailability window, not by this endpoint |
| GET | `/api/admin/settings` | Admin | Get all settings as key-value object |
| PATCH | `/api/admin/settings` | Admin | Upsert settings (`{ key: value, ... }`) |
| POST | `/api/admin/attendance` | Admin | Save attendance for a session (`{ session_id, records: [{user_id, attended}] }`) — auto-deducts passes (no-shows still deduct), marks session completed. Accepts legacy `user_ids` array (all treated as attended). |
| DELETE | `/api/admin/attendance` | Admin | Remove a single attendance record (`{ session_id, user_id }`) — reverses pass deduction |
| POST | `/api/admin/settings` | Admin | Admin actions. Body `{ action: 'telegram-test' }` sends a test Telegram message using current settings. |
| GET | `/api/pass-requests` | User | List pass requests (admin sees all, user sees own) |
| POST | `/api/pass-requests` | User | Create a pass request (`{ pass_type_id, payment_method, notes }`) |
| PATCH | `/api/pass-requests` | Admin | Approve/decline a request (`{ id, status }`) — auto-creates user_pass on approve; also edits the original Telegram message in place |
| POST | `/api/pass-requests?webhook=telegram` | Telegram (secret header) | Telegram webhook for inline buttons. Validates `X-Telegram-Bot-Api-Secret-Token` against `telegram_webhook_secret`. Routes by callback_data prefix: `approve:` / `decline:` / `decline_send:` / `decline_cancel:` go through the pass-request flow; `ext:approve:<windowDays>` / `ext:skip:0` go through `handleExtendCallback` for the bi-weekly schedule-extend nudge. Replies (text messages) are handled by the decline-reason flow |
| POST | `/api/admin/settings` `{ action: 'register-webhook' }` | Admin | Generates a fresh `telegram_webhook_secret`, persists it, and calls Telegram `setWebhook` pointing at `/api/pass-requests?webhook=telegram`. Run once per bot-token change |
| GET | `/api/admin/notifications` | Admin | List notification_log rows. Accepts `?limit`, `?offset`, `?channel`, `?event_type`, `?status` filters. Returns `{ rows, total }` |
| POST | `/api/admin/settings` `{ action: 'sms-test', to? }` | Admin | Sends a test SMS via Twilio. In `test_mode='true'`, reroutes to `jordi_test_phone` automatically. In production mode, requires explicit `to` in body (E.164) so we never accidentally text a real student |
| GET | `/api/admin/settings?type=notifications` | Admin | List rows from `notification_log` (paginated, filterable by `channel`, `event_type`, `status`, `limit`, `offset`). Folded into the settings endpoint to stay under the Vercel Hobby 12-function limit |

## Cron Jobs

Configured in `vercel.json`:

| Schedule | Path | Description |
|---|---|---|
| `0 7 * * *` (daily 7AM UTC) | `/api/cron/generate-sessions` | Generates class sessions for the next 14 days (starting **tomorrow** — never re-creates today's class if it was deleted). For each `(active template, date in window)`: if no session exists, inserts one; if the date falls inside an `unavailability` window, the new session is created with `status='cancelled'` and `cancellation_reason` set. Then it auto-cancels existing scheduled sessions whose date is now in an unavailable window, auto-restores previously auto-cancelled sessions whose window was removed, and deletes future sessions belonging to deactivated templates **only if they have zero active bookings**. Returns `{ created, autoCancelled, restored, cleanedUp, cleanupSkippedWithBookings, errors, window }`. Supports `?dryRun=1` to compute the plan without writing — the admin schedule page exposes this as a "Vista previa" button. |
| `0 8 * * *` (daily 8AM UTC) | `/api/cron/expire-passes` | (1) Telegram digest to admin listing passes expiring **today** — each entry has a pre-filled WhatsApp deeplink so Claudia can notify the student; (2) Telegram digest listing stale unpaid passes (>3 days old, still `is_paid=false`, still active); (3) On Mondays only, fires the bi-weekly schedule-extend nudge if 13+ days have passed since `extend_nudge_last_sent` — sends a Telegram message with inline `✅ Sí, extender 2 semanas` / `⏭ Ahora no` buttons. The webhook (in `/api/pass-requests`) handles the callbacks: approve calls `runGenerate({ windowDays: 28 })` and edits the message with a counts summary; skip just edits to "saltado". This piggybacks on the daily cron because Vercel Hobby caps function count at 12 and we're at the limit. No SMS sent. |

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
| `/admin/notifications` | `pages/admin/notifications.js` | Notification history: mobile-first card list of all SMS and Telegram sends. Each card has a channel glyph, event title + status pill (color-toned ok/err/warn/neutral), recipient (+ phone for SMS), relative timestamp ("hace 5 min" / "ayer" / fecha) with full timestamp on hover, and an inline short error line for failures. Twilio JSON errors are parsed so only the human message is shown; the raw JSON, message preview, and exact timestamp live in a "Detalles" expander. Left border + faint pink fill highlight failed cards. Filterable by channel and event (2-col grid, single col under 380px). 25 per page, centered prev/next pagination |

## Components

| File | Export | Description |
|---|---|---|
| `components/nav.js` | `renderNav()` | Responsive navigation. Top bar (sticky) is rendered for both views; on mobile it shows brand + view-pill (master admin) + lang/logout icons (admin also has a hamburger for the dropdown of Schedule/Settings). On mobile (<768px) every authenticated screen also gets a fixed 4-tab bottom-nav: **Student** = Inicio / Clases / Mis Pases / Perfil, **Admin** = Panel / Asistencia / Usuarios / Pases. Bottom-nav is hidden ≥768px (top-nav links are the desktop UI). Body gets `has-bottom-nav` so layout reserves space and toast positioning shifts above the bar |
| `components/class-card.js` | `renderClassCard(session, booking, spotsLeft, hasActivePass)` | Redesigned card: calendar-block date on the left (DOW / day / month), big time + custom-SVG class-type badge in the body, spots count with people icon, and an action area (sign-up button or booked pill + cancel). Hybrid bookings show a chosen-mode pill ("In-person" / "Online") next to the booked pill. The sign-up button on hybrid classes carries `js-signup-hybrid` so the schedule page knows to open the mode-picker modal |
| `lib/icons.js` | `icon(name, opts)` / `classTypeIcon(type)` | Custom SVG icon set. All icons are 24×24 stroke-based, inherit `currentColor`, and replace what would otherwise be standard emojis. Includes class-type icons (in_person, online, hybrid), nav icons (classes, passes, more, home, history, profile, lang, logout), view-toggle icons (admin/student shields), brand mark (lotus), and status icons (check, x, clock, spots, alert, arrow_right) |
| `components/pass-card.js` | `renderPassCard(pass, passType)` | Card showing pass kind, classes remaining, expiry date, and status badge (active/expired/used up) |
| `components/toast.js` | `showToast(message, type)` | Fixed-position toast notification (success/error/info), auto-dismisses after 3s |
| `components/confirm.js` | `showConfirm({ title, message, confirmText, cancelText, variant, icon })` | App-wide confirmation modal returning `Promise<boolean>`. Replaces the browser-native `window.confirm()` everywhere. Variants: `default` / `warning` / `danger` (changes icon + button color). Backdrop click and Esc cancel; Enter confirms. All defaults pull from i18n (`general.confirm`, `general.cancel`, `confirm.defaultTitle`). Used by: delete template/session/unavailability (schedule.js), delete pass (user-detail.js), resync templates (schedule.js), restore WhatsApp defaults (settings.js) |

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
- **Bilingual coverage is mandatory.** When you add or change any user-visible string, add it under BOTH the `es:` and `en:` blocks of `public/lib/i18n.js` and pass it through `t('key')`. Never inline a Spanish-only or English-only string in a template literal — that's how the wrong language sneaks in. When editing existing strings, update both languages in the same commit. Greppable rule: a `t('foo.bar')` call in code must have an `'foo.bar':` entry in both language blocks

## Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| User Registration & Login | Built | Email/password via Supabase Auth with email confirmation |
| Master Admin Auto-Assignment | Built | Hardcoded emails get admin role on signup, cannot be demoted |
| Role-Based Access Control | Built | Two roles (admin/user) enforced via RLS and frontend guards |
| Class Schedule Templates | Built | Recurring weekly templates with day, time, type, capacity. Admin schedule page renders templates as collapsed cards (title `Day · HH:MM`, meta `type · capacity summary`, active/inactive badge). Tap to expand → stacked editable fields (day/time/type/capacity, per-mode pair shown for hybrid) plus Save / Disable / Delete actions. Upcoming sessions list rebuilt as compact `session-row` cards instead of a wide table so both sections read well on 320px-wide phones |
| One-off Sessions | Built | Admin can add ad-hoc class sessions not tied to a template (e.g. special workshops). Appears in upcoming sessions list and can be deleted individually |
| Session Generation (Cron) | Built | Daily cron generates sessions for the next 14 days starting **tomorrow** (so a deleted "today" class doesn't get re-created same-day). Idempotent via `(template_id, date)` uniqueness. Now also: auto-cancels sessions in `unavailability` windows (sets `status='cancelled'` + `cancellation_reason`), auto-restores when the window is removed, and cleans up sessions belonging to deactivated templates if they have no bookings. Admin schedule page exposes "Vista previa" (dry-run), "Generar próximas 2 semanas" (apply), and "Aplicar cambios de plantilla" (resync) buttons. The generate response surfaces a counts summary (`+N · ⊘N · ↺N · 🗑N`). |
| Teacher Unavailability | Built | Admin can mark date ranges (vacations, retreats, holidays) on the schedule page → "Días no disponibles". On insert/delete, the page auto-runs the generate cron so existing future sessions in the range are auto-cancelled (status='cancelled', cancellation_reason set, auto_cancelled=true), and removing a range restores them (only auto_cancelled rows). Students see those sessions in their schedule with a strikethrough + a red "Class cancelled · <reason>" pill instead of the slot disappearing. The signup button is disabled. Admin's upcoming-sessions list also shows cancelled rows with strikethrough + reason. Cancelled sessions with active bookings trigger a per-session Telegram notification to Claudia listing each affected student with a tap-to-message WhatsApp deeplink |
| Manual Class Cancellation | Built | On the admin schedule page, every upcoming scheduled session has a "Cancelar clase" button. Tapping it opens a `prompt()` for a reason — whatever Claudia types is stored on the session as `cancellation_reason` and shown verbatim to students on the schedule + dashboard ("Class cancelled · <reason>"), and is also interpolated into the `{reason}` placeholder of the WhatsApp template Claudia gets to send each affected student. Empty reason defaults to `'Cancelada'`. Then POSTs to `/api/admin/schedule?action=cancel-session`. The session keeps its slot in the schedule but flips to status='cancelled' (auto_cancelled=false, so the cron's auto-restore never re-opens it). Manually-cancelled sessions show a "Reabrir" button to undo. After cancel, Claudia gets a Telegram message per cancelled session listing each booked student with a `wa.me/<phone>?text=...` deeplink pre-filled from the editable `wa_template_class_cancelled` template (placeholders: `{name}`, `{date}`, `{time}`, `{reason}`) |
| Schedule-Extend Nudge (cron) | Built | Every other Monday morning, the daily `expire-passes` cron sends Claudia a Telegram message: "Hoy hay clases hasta el <date>. ¿Generar 2 semanas más?" with inline `✅ Sí, extender 2 semanas` (callback_data `ext:approve:28`) and `⏭ Ahora no` (`ext:skip:0`) buttons. Approval handled by the existing webhook in `/api/pass-requests` — it imports `runGenerate` from the cron module and calls it with `windowDays=28`, then edits the message with a `+N · ⊘N · ↺N` summary. Skip just edits the message to "saltado" and the next nudge fires in 13+ days. Cadence is enforced by `settings.extend_nudge_last_sent`. Lives inside `expire-passes` because Vercel Hobby caps function count at 12 and we're at the limit |
| Cancelled-Class Student Alerts | Built | Bookings keep their row when their session is cancelled (auto or manual), so the student dashboard surfaces an urgent red banner at the top — "⚠ N class(es) you booked were cancelled" — listing each cancelled date/time and the reason. The same items are also struck-through with a red "Class cancelled" tag in the dashboard's Upcoming Classes list and on the schedule page. Students decide for themselves whether to leave the booking or cancel it from the schedule |
| Resync Templates → Sessions | Built | Editing a template no longer leaves already-generated future sessions stale. Admin clicks "Aplicar cambios de plantilla" on the schedule page to push `start_time`, `class_type`, and capacity fields from each active template onto every future scheduled session that uses it. The toast reports how many were updated and how many had active bookings (so admin knows whether to message students) |
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
| Admin Dashboard | Built | Today's + tomorrow's classes as expandable cards. Each card shows time, class type, signed-up vs capacity (hybrid shows in-person/online breakdown). Tap a card to expand inline and mark attendance for booked students (✓ / ✗ / —) with an inline Save button — no navigation needed. Each expanded card also has an "Abrir asistencia completa" link to the full attendance page for walk-ins / extra controls. Plus expiring pass alerts and low-class alerts |
| User Management | Built | View all users, user detail, toggle admin role, assign passes |
| Studio Settings | Built | Location, meeting link, sign-up window, default capacity |
| Bilingual UI (ES/EN) | Built | Full Spanish/English with toggle, persisted via cookie |
| View as Student Toggle | Built | Master admins can toggle between admin and student view via the segmented pill in the nav. Student view shows their own real data (passes, bookings, attendance). Nav turns blue in student mode. State persists in `sessionStorage` so it survives reloads within the session, resets on logout. Only visible to master admin emails. |
| Responsive Mobile-First UI | Built | Hamburger nav, card layouts, 800px max-width desktop |
| Profile Management | Built | Edit name/phone, change password |
| Online Class Support | Built | Three class types (online, in-person, hybrid) with meeting link |
| Pass Expiry Monitoring (Cron) | Built | Daily cron identifies expiring passes and low-remaining passes. See Cron Jobs section for details. |
| Pass Status Banners | Built | Dashboard and schedule page show contextual banners: amber warning when active pass expires in ≤7 days ("vence en N días / mañana / hoy"), red/urgent banner when out of classes (`classes_remaining=0`) or no active pass. All banners link to `#/my-passes`. Expiry and out-of-classes states also shown on the schedule page above the class list. `.no-pass-banner--urgent` CSS modifier adds red background for the urgent states. |
| Pass Requests | Built | Students can request passes from the passes page. Shows available pass types with MXN prices, request button opens modal with payment method and notes. Modal shows studio bank details (holder/bank/account/CLABE/card) configured in admin settings — clicking a value copies it. Student can check "I've made the payment" which prepends `[PAID]` to notes. Students see their request history with status badges. Pending requests also surface on the student dashboard as a yellow-bordered "waiting for Claudia to verify" card, so students get immediate feedback after submitting. Admins see pending requests on the pass types page with approve/decline buttons. Approving auto-creates the user_pass assignment and marks it `is_paid=true` — approval is Claudia's confirmation that payment has been verified (transfer) or collected (cash). For cash the expected workflow is: student brings cash to the studio → Claudia collects → Claudia taps Approve. |
| Payment Instructions | Built | Admin configures bank details (holder, bank name, account, CLABE, card number, free-form instructions) in settings. Shown to students in pass-request modal with copy-on-click |
| Icon Nav | Built | Logout, language, profile are icon-only buttons grouped on the right side of the nav. Main section links remain in the collapsible list. Language button shows the *other* language code (ES/EN) |
| SMS to Students (Twilio) | Removed | SMS has been replaced by WhatsApp deeplinks for all student-facing notifications. Twilio SMS is no longer triggered from the app. `lib/sms.js` still exists but is no longer called. The `sms_log` table still exists but is unused. |
| SMS Opt-in | Built | `profiles.sms_opt_in` defaults to `TRUE`. Checkbox on registration (defaults checked, with text "Recibir notificaciones por SMS"). Toggle on profile page. Trigger `handle_new_user()` reads `sms_opt_in` from signup metadata. The SMS lib short-circuits with `reason: 'opted_out'` when the flag is false (admin-only sends bypass via `bypassOptIn: true`) |
| Test-Mode Routing | Built | A single `test_mode` setting (toggleable from admin settings page as a segmented pill between "👩‍🦰 Claudia (producción)" and "🧪 Jordi (pruebas)" — saves on click, no separate Save button) reroutes ALL outgoing notifications. When on: Telegram messages go to `jordi_telegram_chat_id` with a `🧪 [TEST]` prefix; SMS go to `jordi_test_phone` with a `[TEST]` prefix. Lets Jordi safely test approval flow / cron without spamming Claudia or real students. The toggle is now hidden from non-super-admin sessions (Claudia doesn't see it) — gated by `isSuperAdmin()` in `public/lib/super-admin.js`. Bot token, chat IDs, Twilio test phone, and the SMS/Telegram test buttons are no longer exposed in the UI — they're set in DB once and left alone. Re-register the Telegram webhook by running the `register-webhook` settings POST manually if the bot token ever changes |
| Admin Permissions Control | Built | Super-admin-only "Permisos de Admin" section in settings. Currently one toggle: `claudia_can_generate_sessions` — when off, the "Generate & Sync" card on the schedule page is hidden for non-super-admin admins (Claudia). Jordi always sees it. Toggle saves immediately to `settings` table |
| Super-Admin CC to Jordi | Built | Hidden under the recipient toggle (super-admin only): a "Recibir copia en producción" checkbox that flips `settings.cc_super_admin`. When enabled AND `test_mode=false`, every Telegram message Claudia receives also fires a fire-and-forget CC to `jordi_telegram_chat_id` with the **English** body, prefixed `📋 [CC]`. Buttons render but their `callback_data` is rewritten to `cc_noop:<original>` — the webhook handles `cc_noop:` by answering with a "CC copy — actions go to Claudia" toast. Additionally, after Claudia clicks an inline button (approve/decline/extend/skip), `sendCcEvent(textEn)` posts a separate `📌 [Event]` summary to Jordi. Implementation: `sendTelegram(text, opts)` accepts `opts.englishText`; every prod-facing send site (new pass request, approved/declined edits, expiry digest, stale unpaid digest, extend nudge, low-classes alert, class cancelled, new sign-up) builds both ES and EN bodies. Internal Claudia-only intermediate steps (decline-reason force_reply prompt, decline preview) intentionally don't CC |
| Editable WhatsApp Templates | Built | Admin can edit the WhatsApp message templates from settings → "Plantillas de WhatsApp" (approved / declined / expiring today / last class used / class cancelled / welcome new signup). Templates support `{name}`, `{kind}`, `{reason}`, `{date}`, `{time}` placeholders depending on the template, are persisted in `settings` table (`wa_template_*` keys), and read at send time via `getWaTemplate()` in `lib/telegram.js`. Section has its own Save button and a "Restaurar predeterminados" button that resets the textareas to the in-code defaults (admin still has to Save) |
| Clean URLs (no hash) | Built | SPA uses History API instead of hash routing — URLs are `/dashboard`, `/admin/users/abc-123`, etc. `vercel.json` rewrites every non-asset / non-`/api` path to `/public/index.html` so refreshes and deep links resolve. The router (`public/lib/router.js`) intercepts clicks on internal `<a href="/...">` so navigation stays in-app. Supabase password-reset links use `/reset-password` — make sure that path is in the project's "Allowed Redirect URLs" in the Supabase dashboard |
| New-Signup Telegram Notification | Built | When a new student finishes registering, the register page calls `POST /api/me?action=notify-signup` (fire-and-forget). The endpoint (in `api/me/index.js`) sends a Telegram message to Claudia: name, email, phone, and a pre-filled WhatsApp deeplink built from the editable `wa_template_welcome` template (so she can tap-to-greet). Informational only — no buttons, no approval gate. Idempotent (checks `notification_log` for a prior `new_signup` row matching the email). Requires email confirmation to be **off** in Supabase auth settings (otherwise the user has no session at signUp time and the call is silently skipped) |
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
| Installable PWA | Built | `public/manifest.json` (`id: /`, name "Jivatma", `display: standalone`, `orientation: portrait`, `theme_color`/`background_color` `#852519` to match the brand-icon maroon, plus a `shortcuts` array exposing Horario / Mis pases / Inicio as Android long-press quick actions). Icons in `public/icons/` generated from `public/brand/logo.svg` via sharp: 192/512 `any` + 192/512 `maskable` (~15% safe-zone padding so Android adaptive shapes don't clip), plus 180px apple-touch-icon and 16/32 favicons. iOS splash screens at `public/icons/splash/` (10 portrait sizes covering iPhone SE through 15 Pro Max) with media-queried `apple-touch-startup-image` links in the head; iOS status bar uses `black-translucent` so the maroon flows under the status bar. `public/sw.js` does shell precache on install + stale-while-revalidate for same-origin static assets, network-first for navigations (falls back to cached `/index.html` offline), never caches `/api/*` or cross-origin (Supabase, CDN). The SW does NOT call `skipWaiting()` automatically — new SWs park in waiting state. `public/lib/pwa-update.js` registers `/sw.js`, watches for `installing`/`waiting` workers, and shows a fixed-bottom "Nueva versión disponible — Recargar" banner. Tapping Recargar postMessages `SKIP_WAITING` to the waiting SW; the page reloads once `controllerchange` fires. Re-checks for updates on tab focus. Head has manifest link, apple-touch-icon, `theme-color`, and `apple-mobile-web-app-*` / `mobile-web-app-capable` meta tags. `vercel.json` rewrite already excludes any path containing a `.` so `/manifest.json` and `/sw.js` serve as static files. To force-update existing users, bump `CACHE_VERSION` in `public/sw.js` |
| Payment Processing | Not Built | No online payments — passes assigned manually, payment tracked as cash/transfer/other |
| Waitlist | Not Built | No waitlist when classes are full — students see "Full" |

## Known Issues

_No known issues. Add issues here as they are discovered during development or testing._
