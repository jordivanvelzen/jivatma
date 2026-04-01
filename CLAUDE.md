# Jivatma

## Overview

Jivatma is a web application in early development. Currently at scaffold stage (v0.1.0).

## Tech Stack

- **Frontend:** Vanilla HTML / CSS / JavaScript (no framework)
- **Backend:** Node.js serverless functions on Vercel
- **Database:** PostgreSQL via Neon serverless (`@neondatabase/serverless`)
  - **Note:** May switch to Supabase — to be confirmed
- **Hosting:** Vercel
- **Package manager:** npm

## Project Structure

```
api/            → Vercel serverless functions (each file = one endpoint)
lib/            → Shared server-side modules (db connection, utilities)
public/         → Static frontend files (HTML, CSS, JS) served at /
scripts/        → One-off scripts (DB schema, migrations)
```

## Architecture

- `vercel.json` routes `/api/*` to serverless functions and `/*` to `public/`
- Database connection is initialized in `lib/db.js` and exports a `sql` tagged template function
- Serverless functions use standard Vercel handler signature: `export default function handler(req, res)`
- Frontend is plain HTML that loads `app.js` and `style.css`

## Environment Variables

See `.env.example`:

| Variable           | Purpose                              |
|--------------------|--------------------------------------|
| `NEON_DATABASE_URL`| PostgreSQL connection string         |
| `ADMIN_PIN`        | Admin authentication PIN             |

## Development

```bash
npm install
npm run dev      # starts vercel dev on localhost
```

## Current State

### Implemented
- Project scaffold and configuration
- Database connection module (`lib/db.js`)
- Example API endpoint (`GET /api/hello` → `{ ok: true, message: 'Jivatma API' }`)
- Basic HTML landing page with CSS reset

### Not Yet Implemented
- Real database schema (only placeholder `users` table exists)
- Authentication / admin PIN logic
- Frontend UI and pages
- Application features (TBD)

## Database Schema

Current schema is in `scripts/schema.sql` — placeholder only:

- `users` table: `id` (serial PK), `created_at` (timestamptz)

## API Endpoints

| Method | Path         | Description          | Status      |
|--------|--------------|----------------------|-------------|
| GET    | `/api/hello` | Health check / hello | Implemented |

## Conventions

- ES modules (`"type": "module"` in package.json) — use `import`/`export`, not `require`
- One serverless function per file in `api/`
- Keep frontend vanilla (no build step, no bundler)
- CSS in `public/style.css`, JS in `public/app.js`
