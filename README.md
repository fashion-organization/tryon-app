# Virtual try-on — web app

The Stage 1 app from the plan in `F:\Work\DOCS` ([PROJECT-PLAN.md](../DOCS/PROJECT-PLAN.md), [IMPLEMENTATION-GUIDE.md](../DOCS/IMPLEMENTATION-GUIDE.md)). Decisions are logged in [docs/decisions.md](docs/decisions.md).

Stack: Next.js 16 (App Router), TypeScript, Tailwind 4, shadcn/ui, Supabase (database, sign-in, storage), Vercel (hosting).

## Run it locally

```powershell
npm install
```

```powershell
npm run dev
```

Open http://localhost:3000 and http://localhost:3000/api/health.

Other commands: `npm run build`, `npm run lint`, `npx tsc --noEmit`.

## Step 1.1 status

| Part | Status |
|---|---|
| Next.js app, Tailwind, shadcn/ui | Done |
| `/api/health` returns `{ ok, commit, env, time }` | Done, tested locally |
| `.env.example`, decision log, Supabase CLI folder (`supabase/`) | Done |
| Git repository (branch `main`) | Created locally, nothing committed yet |
| GitHub repository | **You:** step A below |
| Supabase projects (dev + prod) | **You:** step B below |
| Vercel hosting | **You:** step C below |
| Sentry and PostHog | After A-C (step D) |

**Step 1.1 is done when** pushing to `main` deploys, and `/api/health` on the production URL shows the latest commit.

## One-time setup (about 45 minutes, all free tiers)

### A. GitHub (5 minutes)
1. Sign in at [github.com](https://github.com) and create a **new private repository** named `tryon-app`. Leave it empty: no README, no .gitignore, no licence.
2. Copy the HTTPS address it shows, e.g. `https://github.com/YOUR-NAME/tryon-app.git`.
3. Once the first commit exists, connect and push from this folder (the first push opens a browser to sign in):
   ```powershell
   git remote add origin https://github.com/YOUR-NAME/tryon-app.git
   ```
   ```powershell
   git push -u origin main
   ```

### B. Supabase (15 minutes)
Two projects, so testing never touches real users' data.

1. Sign up at [supabase.com](https://supabase.com) (signing in with GitHub is easiest).
2. Create a project named `tryon-dev`. Region: a US region close to you. Set a strong database password and save it in a password manager.
3. Create a second project named `tryon-prod`, same region, a different password.
4. For each project, open **Project Settings → API keys** (labels may differ slightly) and note:
   - the **Project URL**,
   - the **publishable** key (older projects: "anon"),
   - the **secret** key (older projects: "service_role"). Treat it like a password.
5. Copy `.env.example` to `.env.local` and fill it with the **dev** project's values:
   ```powershell
   Copy-Item .env.example .env.local
   ```

Linking the CLI to the projects (`npx supabase login`, `npx supabase link`) happens in step 1.2, together with the first migration.

### C. Vercel (10 minutes)
1. Sign up at [vercel.com](https://vercel.com) with your GitHub account (Hobby plan is free).
2. **Add New → Project**, import `tryon-app` from GitHub. Framework is detected as Next.js; keep the defaults.
3. Before deploying, open **Environment Variables** and add the three Supabase variables twice:
   - with the **prod** values, ticking only **Production**;
   - with the **dev** values, ticking **Preview** and **Development**.
4. Deploy. Open `https://<your-project>.vercel.app/api/health`. It should show `"env":"production"` and a `commit` matching your latest commit (`git log -1 --format=%H`).
5. Push any small change to `main` and check that `commit` updates. That completes step 1.1.

Note: Vercel's free Hobby plan is for non-commercial use. Moving to a paid plan becomes necessary before the product earns money.

### D. Sentry and PostHog (15 minutes, after C)
1. [sentry.io](https://sentry.io): create a Next.js project. Then run its setup wizard here and accept its suggestions:
   ```powershell
   npx @sentry/wizard@latest -i nextjs
   ```
2. [posthog.com](https://posthog.com): create a project (US cloud), copy the project API key and host into `.env.local` and Vercel as `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`. Analytics stay off until the visitor accepts the cookie notice (built in step 1.13).

Tell Claude when A-C are done; it will wire up PostHog and check the Sentry wizard's changes.

## Rules for this codebase
- Every database change is a migration file in `supabase/migrations/`.
- Every environment variable is listed in `.env.example` without its value.
- Secret keys never get the `NEXT_PUBLIC_` prefix.
- This Next.js version differs from older ones; check `node_modules/next/dist/docs/` before using an unfamiliar API (see `AGENTS.md`).
