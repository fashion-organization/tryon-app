# Decisions

One or two lines each: date, decision, reason. Planning documents live in `F:\Work\DOCS`.

- 2026-11-24 — npm instead of pnpm. It ships with Node, so there is one less tool to install; the plan does not depend on pnpm.
- 2026-11-24 — Next.js 16.4 (App Router, Turbopack, Cache Components on), TypeScript, Tailwind 4, shadcn/ui. As created by `create-next-app@latest`; this version differs from older Next.js, so its bundled docs in `node_modules/next/dist/docs/` are the reference.
- 2026-11-24 — Two Supabase projects, `tryon-dev` (local + Vercel previews) and `tryon-prod` (production only). Real user data never touches dev.
- 2026-11-24 — The database is changed only through migration files in `supabase/migrations/`, applied with the Supabase CLI. No edits in the dashboard table editor.
- 2026-11-24 — Sentry and PostHog are wired once their accounts exist, still within step 1.1; the app runs without them.
