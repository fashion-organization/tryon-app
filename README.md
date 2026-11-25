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
| GitHub repository | Done (private, branch `main`) |
| Supabase projects (dev + prod) | Done |
| Vercel hosting | Done, production `/api/health` verified 2026-11-25 |
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

## Step 1.2: the database

The schema is one migration: [supabase/migrations/20261125044334_initial_schema.sql](supabase/migrations/20261125044334_initial_schema.sql). It creates `profiles`, `consents`, `user_photos`, `products` and `tryon_jobs`, turns on row-level security, and creates the storage buckets `user-photos` and `tryon-results` (private) and `product-images` (public).

Who can do what:

| | Signed-in user (browser) | Server (secret key) |
|---|---|---|
| `profiles` | Read and edit their own details. Cannot change `role` or the 18+ confirmation | Everything |
| `consents` | Read their own | Writes them (records the IP) |
| `user_photos` | Read their own, choose the primary one | Adds them after moderation, deletes them |
| `products` | Read published ones (signed-out visitors too). Admins: everything | Everything |
| `tryon_jobs` | Read their own, rate them | Creates and updates them (they cost money) |
| Photo and result files | Read files in their own folder (`<user_id>/...`) | Uploads and deletes |

### Apply it (you, once)
For now one Supabase project, `tryon-prod`, is used everywhere (see [docs/decisions.md](docs/decisions.md)). `.env.local` and all three Vercel environments hold its values.

1. Sign the CLI in to Supabase (opens a browser):
   ```powershell
   npx supabase login
   ```
2. Link this folder to the project. The project ref is the code in the dashboard address, `supabase.com/dashboard/project/<ref>`. It asks for the database password.
   ```powershell
   npx supabase link --project-ref bozkxkwxgkkthkyfssmc
   ```
3. Apply the migration. It lists what it will apply and asks to confirm.
   ```powershell
   npm run db:push
   ```
4. Prove user A cannot read user B's rows or files. This creates two throw-away users and deletes them afterwards. Run it only while the project has no real users:
   ```powershell
   npm run test:rls
   ```

### After every schema change
Regenerate the TypeScript types from the linked database:
```powershell
npm run db:types
```

## Step 1.3: sign-up and sign-in

Pages: `/sign-up`, `/sign-in`, `/forgot-password`, `/reset-password`, `/welcome`, `/account`, plus draft `/terms` and `/privacy`. Email links and Google come back to `/auth/callback`. `proxy.ts` keeps the session fresh and sends signed-out visitors on protected pages to sign-in; each page checks again on the server (`lib/auth/dal.ts`).

Sign-up requires "I am 18 or older" and acceptance of the terms and privacy policy; both are stored in `consents` with the IP address, and `profiles.is_adult_confirmed_at` is set. Someone who signs in with Google is asked the same on `/welcome` before they can use the site.

### Supabase settings (you, once, in the dashboard)

**1. Authentication → URL Configuration**
- **Site URL:** your production address, e.g. `https://tryon-app.vercel.app`
- **Redirect URLs**, add all three (without these, email links and Google sign-in fail):
  - `http://localhost:3000/**`
  - `https://tryon-app.vercel.app/**` (your production address)
  - `https://*-YOUR-VERCEL-TEAM.vercel.app/**` (preview deployments; the team part is in any preview URL)

**2. Authentication → Sign In / Providers → Email:** keep **Confirm email** on.

**3. Authentication → Emails → Templates.** Supabase only allows editing templates once custom SMTP is set up (item 4), so do this together with item 4, before Stage 2. Until then the default templates work, as long as the email link is opened in the same browser that signed up or asked for the reset. After the change, links work on any device. Replace the link in two templates:
- **Confirm signup:**
  ```html
  <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
  ```
- **Reset password:**
  ```html
  <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">Choose a new password</a>
  ```

**4. Email sending.** Supabase's built-in sender is for testing only: a few emails per hour and it may deliver only to your own team's addresses. Before Stage 2 (outside testers), connect a real email service under **Authentication → Emails → SMTP Settings** (for example Resend, which has a free tier).

### Google sign-in (you, about 15 minutes)
1. In [Google Cloud Console](https://console.cloud.google.com), pick or create a project.
2. **Google Auth Platform → Branding** (older consoles: "OAuth consent screen"): app name "Virtual try-on", your support email. Audience: **External**. While testing, add your own Google address under **Test users**.
3. **Clients → Create client** → type **Web application**.
   - Authorized JavaScript origins: `http://localhost:3000` and your production address.
   - Authorized redirect URI: `https://bozkxkwxgkkthkyfssmc.supabase.co/auth/v1/callback`
4. Copy the **Client ID** and **Client secret**.
5. In Supabase: **Authentication → Sign In / Providers → Google**: turn it on, paste both, save.

The secret stays in Supabase; nothing is added to `.env.local` or Vercel.

### Check (the step 1.3 "done when")
On the production URL: create an account, confirm by email, sign out, sign in with Google (you land on `/welcome` the first time), and reset a password.

## Step 1.5: photo upload

`/photos` shows the body-photo consent first (stored in `consents` as `body_photo`, naming the services that receive photos). Then: take or choose a photo; the browser shrinks it to 2000 px JPEG; `POST /api/photos` re-encodes it on the server (drops GPS and other metadata), checks it with OpenAI's free moderation service, and stores it in the private `user-photos` bucket. Up to 5 photos; one is the main photo; deleting a photo deletes its file and its try-on results.

### OpenAI key for the photo check (you, about 10 minutes)
The moderation check is free, but OpenAI needs an account and an API key.

1. Go to [platform.openai.com](https://platform.openai.com) and sign up or sign in.
2. If it asks you to create an organization or project, name it `tryon-app`.
3. Top-right gear icon → **API keys** (or open [platform.openai.com/api-keys](https://platform.openai.com/api-keys)) → **Create new secret key**.
   - Name: `tryon-app moderation`. Project: `tryon-app`. Permissions: **All** is fine (or **Restricted** with only *Model capabilities → Write*).
   - Click **Create**, then **Copy**. It starts with `sk-`. You can't see it again later, so paste it now.
4. Add it to `.env.local`:
   ```
   OPENAI_API_KEY=sk-...
   ```
5. Add it to Vercel: **Settings → Environment Variables → Add**: name `OPENAI_API_KEY`, the same value, tick **Production**, **Preview** and **Development**, mark it **Sensitive**, save. Then **Deployments → ⋯ on the latest → Redeploy**.

Never paste the key into chat or commit it. Without the key, photos are accepted unchecked on your computer, and refused on the live site ("We can't check photos right now").

### Check (the step 1.5 "done when")
On the live site, with a real iPhone and a real Android phone: open **My photos**, accept the consent, tap **Take a photo**, and see it listed. Then delete it.

## Step 1.6: catalog

`/catalog` lists published products, with tabs for garment type, search by name and sort by newest or price. All of it works through the address bar, without JavaScript. `/products/<slug>` shows the gallery, price, sizes, size chart (cm and inches) and **Buy at shop**; **Try it on** arrives in step 1.7. Product data is public and cached for a few minutes.

The catalog holds 20 **placeholder** products from `npm run seed` ("Sample Shop": drawn garments, `example.com` buy links). The seed is safe to run again. Real products replace them once a brand gives permission (see `F:\Work\DOCS\BRAND-OUTREACH-EMAIL.md`). Placeholder garments are fine for building the pages, but not for judging try-on quality.

Size charts are stored on each product as body measurements in cm:
```json
{ "unit": "cm", "measurements": ["chest", "waist"], "sizes": { "M": { "chest": [92, 99], "waist": [76, 83] } } }
```

## Step 1.7: the try-on pipeline

The API behind the try-on (the screens come in step 1.8):

| Call | What it does |
|---|---|
| `POST /api/tryon` with `{ photoId, productId }` | Checks sign-in, 18+ and photo consent, that the photo is the user's and ready, and that the product is published. Then, in one locked database call (`start_tryon_job`): returns the earlier result if this photo and product were already done (free, instant), joins a job already running (double clicks), refuses over the daily limits, or creates a job and sends it to the provider. Answers `200 { job }` when finished, `202 { job }` while running. |
| `GET /api/tryon/<id>` | The job's state. While it runs, asks the provider. When done: downloads the image, checks it with the moderation service, adds the "AI-generated preview" label (and the same words in the image metadata), stores it in `tryon-results/<user>/<job>.jpg` and returns a 1-hour link. A temporary provider error is retried once. |
| `GET /api/cron/sweep` | Fails jobs stuck for more than 3 minutes. Run daily by Vercel Cron (`vercel.json`); polling and new requests also end stuck jobs, so the daily run is only a backstop. |

Limits: `TRYON_DAILY_FREE_PER_USER` (default 3) new try-ons per user and `TRYON_GLOBAL_DAILY_CAP` (default 100) for the whole site, in any 24 hours. Failed try-ons and results served from the cache don't count. Every failure is shown as one of five messages (`lib/tryon/errors.ts`): photo not usable, item not usable, safety filter, busy, unknown.

Providers (`TRYON_PROVIDER`): `mock` returns your own photo after 5 seconds, free, for development (`TRYON_MOCK_FAIL=PoseError` makes it fail, to try the error screens). `fashn-v1.6` (stable, 1 credit) and `fashn-max` (preview model, "fast" mode, 1 credit) call FASHN. Unset means `mock` on your computer and **off** on the live site.

The label image is made once by `node scripts/make-ai-mark.mjs` (Vercel's servers have no fonts to draw text with).

### FASHN key (you, about 10 minutes, needed for real try-ons)
1. Go to [app.fashn.ai](https://app.fashn.ai) and sign up.
2. Open **Billing** (or **Credits**) and buy the smallest pack of API credits. At the time of writing that is about $7.50 for 100 credits; one try-on is 1 credit, and failed try-ons are free.
3. Open **API** (or **Developer → API keys**) → **Create API key**. Name it `tryon-app`. Copy it; it is shown once.
4. Add to `.env.local`:
   ```
   FASHN_API_KEY=...
   TRYON_PROVIDER=fashn-v1.6
   ```
   Remove `TRYON_PROVIDER` (or set it to `mock`) again when you want free local testing.
5. In Vercel → **Settings → Environment Variables**, add:
   - `FASHN_API_KEY`: the key, tick all three environments, mark **Sensitive**.
   - `TRYON_PROVIDER`: `fashn-v1.6`, **Production** only. (Previews then use the free mock.)
   - `TRYON_GLOBAL_DAILY_CAP`: `20` for now, **Production**. That caps spending at about $1.50 a day; raise it later.
   - `CRON_SECRET`: a long random string, **Production**, **Sensitive**. Make one in PowerShell:
     ```powershell
     $b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
     ```
6. **Deployments → ⋯ on the latest → Redeploy**.

Never paste the key into chat or commit it.

### Check (the step 1.7 "done when")
With the real provider: a try-on request from an API client produces a stored result image; the same request again returns at once with no new charge; the 4th new try-on in a day is refused. With the mock provider this was checked on 2026-11-25 (21 checks, including the cache, the limit, the retry and the label).

## Step 1.8: try-on screens

- **Product page → Try it on** opens `/try/<product>` (signed-out visitors sign in and come back). It shows the photo consent or the photo upload first if needed, then your photos with the main one preselected, how many free try-ons are left today, and whether this photo and item were already tried (then it's free and instant).
- **`/tryons/<id>`** is one page that changes as the job runs:
  - waiting: progress messages and bar, the expected time, and a note that it's safe to leave;
  - result: a before/after slider over your photo (drag anywhere on the image, or use the arrow keys), thumbs up/down, **Buy at shop**, size chart, **Try another item**;
  - failure: the specific reason and one next step.

  The browser asks for news every 2.5 seconds.
- **`/tryons`** ("Try-ons" in the header) lists past try-ons, newest first.

The expected time on the waiting screen is a guess per provider (`lib/tryon/queries.ts`) until Stage 0 measures it.

### Check (the step 1.8 "done when")
On a phone: product → Try it on → result, and a failed try-on shows a helpful message. Checked locally at phone size with the mock on 2026-11-25 (including the failure screen via `TRYON_MOCK_FAIL=PoseError`). Still to do on a real phone once deployed.

## Rules for this codebase
- Every database change is a migration file in `supabase/migrations/`.
- Every environment variable is listed in `.env.example` without its value.
- Secret keys never get the `NEXT_PUBLIC_` prefix.
- This Next.js version differs from older ones; check `node_modules/next/dist/docs/` before using an unfamiliar API (see `AGENTS.md`).
