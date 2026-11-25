# Decisions

One or two lines each: date, decision, reason. Planning documents live in `F:\Work\DOCS`.

- 2026-11-24 — npm instead of pnpm. It ships with Node, so there is one less tool to install; the plan does not depend on pnpm.
- 2026-11-24 — Next.js 16.4 (App Router, Turbopack, Cache Components on), TypeScript, Tailwind 4, shadcn/ui. As created by `create-next-app@latest`; this version differs from older Next.js, so its bundled docs in `node_modules/next/dist/docs/` are the reference.
- 2026-11-24 — Two Supabase projects, `tryon-dev` (local + Vercel previews) and `tryon-prod` (production only). Real user data never touches dev.
- 2026-11-24 — The database is changed only through migration files in `supabase/migrations/`, applied with the Supabase CLI. No edits in the dashboard table editor.
- 2026-11-25 — The browser only reads its own rows and edits harmless columns (profile details, primary photo, try-on rating). Photo status, try-on jobs, consents and private files are written by the server with the secret key, so moderation, limits and costs cannot be bypassed from the browser. Tighter than "users read and write their own rows" in the implementation guide.
- 2026-11-25 — Database rules that back up the app code: max 5 non-rejected photos per user; one done result and one in-flight job per (photo, product, provider), which is the cache and stops double charges; a try-on must use the same user's photo; a product cannot be published without a try-on image and a buy link.
- 2026-11-25 — Added `products.slug` (unique) for readable URLs and a seed script that is safe to run twice. `cost_cents` is numeric so $0.075 is stored exactly as 7.50.
- 2026-11-25 — The profile-creation trigger (planned for step 1.3) is in the first migration, since every other table depends on users having a profile.
- 2026-11-25 — One Supabase project for now: `tryon-prod` is used for local work, previews and production (owner's choice, replacing the dev/prod split above). Fine while there are no real users. Before real users arrive (Stage 2), either bring `tryon-dev` back for local work and tests, or never run `test:rls` and seed scripts against data that real people use.
- 2026-11-25 — Supabase CLI 3.x targets the local stack by default, so `db:push` and `db:types` pass `--remote` (the linked project).
- 2026-11-25 — No Docker on the dev machine, so no local Supabase. The migration is checked on an in-memory Postgres before pushing, and `npm run test:rls` checks the real dev project.
- 2026-11-25 — Sign-in uses Supabase Auth through `@supabase/ssr` (session in cookies). `proxy.ts` (Next 16's name for middleware) refreshes the session and does a fast redirect; the real check is `requireUser()` on the server in every protected page and action.
- 2026-11-25 — Consents are written by the server with the secret key, with the IP address. Google users have not ticked the boxes, so any signed-in user without `is_adult_confirmed_at` is sent to `/welcome` first.
- 2026-11-25 — Email links use `token_hash` templates so they work on any device; the callback also accepts `?code=` (Google, default templates).
- 2026-11-25 — Minimum password length 8. Sign-up and reset never reveal whether an email has an account.
- 2026-11-25 — Terms and privacy pages are short drafts with a version string stored with each consent. A lawyer writes the real ones before Stage 5.
- 2026-11-24 — Sentry and PostHog are wired once their accounts exist, still within step 1.1; the app runs without them.
