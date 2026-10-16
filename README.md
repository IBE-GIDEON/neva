# Neva — monorepo

Chat-first marketplace for buying and selling gadgets (Nigeria-first). One shared core, two apps.

```
neva/
  apps/mobile/     Expo SDK 57 app (iOS / Android, runs in Expo Go)
  apps/web/        Neva for web — standalone website, WhatsApp Web-style layout (Next.js App Router)
  packages/core/   Shared code: types, store (zustand), taxonomy, search, places, formatting, theme tokens
  supabase/        One database schema for both apps (tables, RLS, search, rate limits)
  docs/            Setup guides (e.g. Google sign-in)
```

## Run

```bash
npm install          # once, at the repo root (npm workspaces)
npm run mobile       # Expo dev server → scan the QR code with Expo Go
npm run web          # http://localhost:3000
npm run typecheck    # all workspaces
npm run build:web    # production build (next build) → apps/web/.next
```

## How the apps share code
- Business rules live in `packages/core`. Both apps create the same store with `createNevaStore(storage)`:
  mobile passes a batched AsyncStorage adapter, web passes localStorage.
- Colours come from the same palette (`packages/core/src/theme.ts`); web maps them to CSS variables.
- A fix in core applies to phone and web at once.

## Sync between phone and web
Like WhatsApp Web, sync happens through the server. Until Supabase is connected each app keeps its own local data.
Add the same project to both:

- `apps/mobile/.env` → `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `apps/web/.env.local` → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (optional `NEXT_PUBLIC_GOOGLE_SIGN_IN=1`)

Only public keys belong in these files. Never commit service-role / secret keys.

## Accounts & finding people
- Sign up / log in with email + password (Google optional — see `docs/google-sign-in.md`). No phone numbers.
- People find each other for DMs by `@username`, shared usernames, invites, and the Message button on listings and shops.
