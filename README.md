# CRM — Standalone Company Dashboard

Single-tenant CRM for managing leads, offers, jobs, and customer communication.
Built with Vite + React + Supabase (no portal, no marketplace, no Stripe).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite 7 |
| UI | shadcn/ui + Tailwind CSS + Radix UI |
| State | TanStack React Query |
| Forms | react-hook-form + zod |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| Email | Resend (via Edge Functions) |
| PDF | @react-pdf/renderer + jsPDF |
| Tests | Vitest |

---

## Requirements

- Node.js 18+
- A Supabase project ([supabase.com](https://supabase.com))
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
# Required — from Supabase Dashboard → Project Settings → API
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# App identity
VITE_APP_URL=http://localhost:8080
VITE_APP_NAME=CRM

# Email (optional — set as Supabase secret, not a frontend env var)
# VITE_RESEND_API_KEY=re_...
```

> `.env` and `.env.local` are in `.gitignore` and are never committed.

### 4. Apply database migrations

```bash
npx supabase db push
```

See `supabase-schema-needed.md` for a full description of every table and RLS policy.

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
| `npm run lint` | ESLint |
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
│   ├── authUtils.ts           # Pure auth utility functions (fully tested)
│   ├── adminPermissions.ts    # Role/permission system (fully tested)
│   ├── crmAccess.ts           # CRM access check (no-op in standalone mode)
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
  └── exposes: user, session, isLoading, isAdmin, adminRole
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
| `resolveAdminRole(roles)` | Maps a raw string array from `user_roles` to `{ isAdmin, adminRole }` |
| `getResetPasswordUrl(appUrl, origin?)` | Builds the Supabase `redirectTo` URL for password reset |
| `validateAuthForm(email, password, mode)` | Validates the login / forgot-password form fields |
| `validateResetPasswordForm(password, confirmPassword)` | Validates the new-password form |
| `emailSchema` | Zod schema — re-exported for reuse |
| `loginPasswordSchema` | Zod schema (min 6 chars) |
| `resetPasswordSchema` | Zod schema (min 8 chars) |

### Role hierarchy

```
super_admin  (level 100) — full access
admin        (level  50) — full access except user management
moderator    (level  10) — leads, verification, blog
(no role)               — regular company user → /firma dashboard
```

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

Setting a flag to `false` hides only the sidebar link. The route itself still exists.

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

| File | Tests |
|---|---|
| `src/lib/authUtils.ts` | `resolveAdminRole`, `getResetPasswordUrl`, `validateAuthForm`, `validateResetPasswordForm` |
| `src/lib/adminPermissions.ts` | `hasPermission`, `getPermissionsForRole`, `isAdminRole`, `getRoleLevel`, `canModifyRole`, `getAssignableRoles`, `getAccessibleMenuItems` |

---

## Deployment

### Vercel / Netlify (recommended)

1. Connect the repository
2. Add environment variables matching `.env.example`
3. Build command: `npm run build`
4. Output directory: `dist`

### Docker

```bash
docker compose build --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_ANON_KEY=...
docker compose up
```

### Supabase Edge Functions

Deploy individual functions after changes:

```bash
npx supabase functions deploy accept-lead
npx supabase functions deploy send-offer
npx supabase functions deploy send-quittung
# etc.
```

Set secrets for email delivery:

```bash
npx supabase secrets set RESEND_API_KEY=re_...
```

---

## Schema Reference

See [`supabase-schema-needed.md`](./supabase-schema-needed.md) for:
- All 22 tables with columns and RLS patterns
- Storage bucket definitions
- Edge Functions still in use

---

## License

Proprietary — All rights reserved
