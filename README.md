# CRM — Standalone Company Dashboard

Single-tenant CRM for managing leads, offers, jobs, and customer communication.
Built with Vite + React + Supabase (no portal, no marketplace, no Stripe).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite 7 |
| UI | shadcn/ui + Tailwind CSS + Radix UI |
| Data | Direct Supabase client + `useState`/`useEffect` (see note below) |
| Forms | react-hook-form + zod (mainly lead forms) |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions), **self-hosted on Coolify** |
| Email | Resend (via Edge Functions) |
| PDF | @react-pdf/renderer + jsPDF |
| i18n | DE / FR / EN — two independent language axes (dashboard vs. document) |
| Tests | Vitest (pure functions only) |

> **Data layer:** `QueryClientProvider` is mounted in `src/App.tsx`, but the CRM
> pages under `/firma/*` do **not** use `useQuery` (verified: 0 usages). They fetch
> with `supabase.from(...).select()` + `useState`/`useEffect`/`useCallback` and manage
> loading/error manually. Follow this existing pattern when adding a page.

---

## Requirements

- Node.js 18+
- Access to the project's **self-hosted Supabase** stack (Postgres + Auth + Storage +
  Edge Functions), running on Coolify — **not** a supabase.com cloud project. See the
  connection guide: [docs/SUPABASE_MCP_BAGLANTI.md](docs/SUPABASE_MCP_BAGLANTI.md).
- (Optional) Resend account for email delivery

---

## Local Setup

### 1. Clone the repository

```bash
git clone <YOUR_GIT_URL>
cd CRM-Project
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

```env
# Required — URL + anon key of the self-hosted Supabase instance
VITE_SUPABASE_URL=https://your-supabase-host
VITE_SUPABASE_ANON_KEY=eyJ...

# App identity
VITE_APP_URL=http://localhost:8080
VITE_APP_NAME=CRM

# Email (optional — set as Supabase secret, not a frontend env var)
# VITE_RESEND_API_KEY=re_...
```

> `.env` and `.env.local` are in `.gitignore` and are never committed.

### 4. Database migrations

This is a **self-hosted** Supabase stack on Coolify, so the cloud `npx supabase db push`
/ `--linked` flow does **not** apply. Migrations live in `supabase/migrations/`
(`YYYYMMDDHHmmss_*.sql`, never edit an existing file — add a new one) and are applied
against the self-hosted database. See
[docs/SUPABASE_MCP_BAGLANTI.md](docs/SUPABASE_MCP_BAGLANTI.md) for the exact apply paths
(SSH tunnel + `psql`, or `docker exec … psql` on the DB container).

`supabase-schema-needed.md` is an older design/target reference; treat the live DB and
the generated types (`src/integrations/supabase/types.ts`) as the source of truth.

### 5. Start the dev server

```bash
npm run dev
```

The app runs at **http://localhost:8080**.

---

## NPM Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build (sitemap → Vite → prerender) |
| `npm run type-check` | TypeScript check (no emit) |
| `npm run lint` | ESLint — CRM scope only (`src/`); `vibecosystem/` and `supabase/functions/` are excluded in the flat config |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Coverage report |

---

## Project Structure

```
src/
├── App.tsx                    # Route definitions
├── config/
│   └── modules.ts             # Feature flags (show/hide sidebar items)
├── hooks/
│   └── useAuth.tsx            # AuthProvider + useAuth hook
├── lib/
│   ├── authUtils.ts           # Pure auth utility functions (tested)
│   ├── crmAccess.ts           # CRM access check (no-op in standalone mode)
│   ├── erstelleRechnung.ts    # Auftrag → Rechnung mapping (pure, tested)
│   ├── generateRechnungPdf.ts # Swiss QR-bill PDF (pure builder, tested)
│   ├── rechnungStatus.ts      # Invoice status labels/colors (tested)
│   ├── swiss-qr/core.ts       # Swiss QR-IBAN / QRR reference helpers (tested)
│   └── ...                    # Other utilities
├── pages/
│   ├── Auth.tsx               # Login + forgot-password page
│   ├── auth/
│   │   └── ResetPassword.tsx  # Password reset page
│   ├── firma/                 # CRM pages (dashboard, leads, offers, …)
│   └── public/                # Shareable views (offer link, appointment)
├── components/
│   └── firma/
│       ├── FirmaLayout.tsx    # Sidebar + header shell for all CRM pages
│       └── ...
└── integrations/
    └── supabase/
        ├── client.ts          # Supabase client (reads VITE_SUPABASE_* from env)
        └── types.ts           # Generated Database types
```

---

## Auth Module

### Architecture

```
AuthProvider (src/hooks/useAuth.tsx)
  └── wraps the entire app
  └── exposes: user, session, isLoading
  └── actions: signIn, signOut, resetPassword, updatePassword

Auth page (src/pages/Auth.tsx)
  └── login form
  └── forgot-password form
  └── post-login: looks up company → redirects to /firma

ResetPassword page (src/pages/auth/ResetPassword.tsx)
  └── new-password form (requires active Supabase session)
  └── on success → redirects to /firma
```

### Pure utility functions (`src/lib/authUtils.ts`)

All business logic that can be tested without React or Supabase is extracted here:

| Function | Description |
|---|---|
| `getResetPasswordUrl(appUrl, origin?)` | Builds the Supabase `redirectTo` URL for password reset |
| `validateAuthForm(email, password, mode)` | Validates the login / forgot-password form fields |
| `validateResetPasswordForm(password, confirmPassword)` | Validates the new-password form |
| `emailSchema` | Zod schema — re-exported for reuse |
| `loginPasswordSchema` | Zod schema (min 6 chars) |
| `resetPasswordSchema` | Zod schema (min 8 chars) |

### Authorization

The CRM UI gates access on **authentication + company membership** only, enforced by
Supabase RLS. `useAuth` exposes no admin-role fields, and there is no
`adminPermissions.ts` in the frontend anymore. (The `app_role` enum and
`has_role()` / `is_admin()` RPCs still exist at the DB level, but the standalone CRM
pages do not consume them.)

### Login redirect flow

```
User logs in
  ↓
Auth.tsx: fetchSingleCompanyForUser
  ├── company not found     → "Keine Firma verknüpft" screen
  ├── is_verified = false   → "Verifizierung ausstehend" screen
  └── is_verified = true    → navigate("/firma")
```

---

## Feature Flags

Edit `src/config/modules.ts` to show or hide sidebar navigation items:

```ts
export const MODULES = {
  leads: true,
  offers: true,
  contacts: true,
  reports: true,
  calendar: true,
  // ...
  integrations: false, // hidden — not yet implemented
};
```

Setting a flag to `false` hides the sidebar link **and** closes the module's whole `/firma`
route group — direct URLs and sub-routes included — redirecting to the `/firma` dashboard.
Enforcement is centralised in [`src/config/moduleRoutes.ts`](src/config/moduleRoutes.ts) (a
single path→module map) and applied by the `FirmaModuleGuard`; the sidebar reads the same map,
so navigation and route enforcement can't drift.

> **Feature flags are not authorization.** They only shape navigation/UX. Data security is
> enforced by Supabase Auth + RLS. Public token routes (`/offerte/:token`, `/termin/*`,
> `/besichtigung/*`) live outside the CRM layout and are never affected by flags. The `/firma`
> dashboard is never gated (it is the safe redirect target). When you add a `/firma` route, add
> it to `moduleRoutes.ts` too — a completeness test fails otherwise.

---

## Testing

Tests live in `src/lib/__tests__/` and use **Vitest**.
Only pure (non-React, non-Supabase) functions are unit tested.

```bash
npm test                # run all tests
npm run test:watch      # watch mode
npm run test:coverage   # html coverage report in ./coverage/
```

### Test coverage

Only pure functions are covered (React components and Supabase calls are not). Current
suites (verify the exact list with `npm test`; the count changes over time):

| Area | File |
|---|---|
| Auftrag status machine | `src/lib/__tests__/auftragStatus.test.ts` |
| Appointment conflicts | `src/lib/__tests__/appointmentConflicts.test.ts` |
| Rechnung creation (Auftrag → Rechnung) | `src/lib/__tests__/erstelleRechnung.test.ts` |
| Rechnung PDF builder | `src/lib/__tests__/generateRechnungPdf.test.ts` |
| Rechnung status | `src/lib/__tests__/rechnungStatus.test.ts` |
| Swiss QR | `src/lib/swiss-qr/__tests__/core.test.ts` |
| Offer pricing / surcharges / item meta / service type | `src/lib/__tests__/offer*.test.ts` |
| Service type normalization | `src/lib/__tests__/normalizeServiceType.test.ts` |
| Floor utilities | `src/lib/__tests__/floorUtils.test.ts` |
| Lead detailed-form sync | `src/lib/__tests__/leadDetailedFormSync.test.ts` |
| i18n | `src/i18n/__tests__/i18n.test.ts`, `src/components/offers/moving-calculator/__tests__/inventory-i18n.test.ts` |

---

## Deployment

Three deployment flows are **separate** — do not conflate them:

### 1. Frontend (static build)

```bash
docker compose build --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_ANON_KEY=...
docker compose up
```

Deployed via Coolify (Docker) on the project VPS. `npm run build` emits static assets to
`dist/`; a Vercel/Netlify-style static host also works if you prefer.

### 2. Database migrations (production)

Self-hosted — the cloud `db push` / `--linked` flow does not apply. Apply the SQL files in
`supabase/migrations/` against the self-hosted database (SSH tunnel + `psql`, or
`docker exec … psql` on the DB container). Exact paths and gotchas:
[docs/SUPABASE_MCP_BAGLANTI.md](docs/SUPABASE_MCP_BAGLANTI.md).

### 3. Supabase Edge Functions

The functions live in `supabase/functions/` (~47 functions). **A function existing in the
repo does not mean it is deployed** — the self-hosted stack deploys per function, and the
deployed set must be verified on the server (see `docs/SISTEM_PRD.md` §5). Active CRM
functions include `send-offer`, `send-quittung`, `send-rechnung-email`, the `notify-*` and
`admin-*` families, and `translate-content`; Stripe/subscription functions are inert fork
remnants — do not treat them as active.

Secrets (Resend, provider keys) are set as Supabase secrets / Edge env, never as `VITE_*`.
On this self-hosted stack an Edge `.env` change needs a Coolify **Redeploy**, not just a
container restart.

---

## Schema Reference

[`supabase-schema-needed.md`](./supabase-schema-needed.md) is an older design/target
reference (its table list and columns predate the current schema — e.g. it does not cover
the `rechnungen` QR-bill table). For the authoritative picture use:

- `src/integrations/supabase/types.ts` — generated types (source of truth for columns)
- `supabase/migrations/` — chronological schema history
- [`docs/SISTEM_PRD.md`](./docs/SISTEM_PRD.md) — domain model, table relationships, and the
  active-vs-fork-remnant distinction

---

## License

Proprietary — All rights reserved
