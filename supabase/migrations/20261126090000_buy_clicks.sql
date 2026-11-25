-- Step 1.10: every "Buy at shop" click goes through /go/<product> and is recorded here.
-- Written only by the server (secret key). Nobody reads it from the browser; the admin page
-- (step 1.12) reads it on the server.

create table public.buy_clicks (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  -- Null for signed-out visitors, and after the user deletes their account.
  user_id      uuid references auth.users (id) on delete set null,
  -- The try-on the click came from, if any.
  tryon_job_id uuid references public.tryon_jobs (id) on delete set null,
  source       text not null check (source in ('product', 'tryon', 'other')),
  created_at   timestamptz not null default now()
);

create index buy_clicks_product_created on public.buy_clicks (product_id, created_at desc);
create index buy_clicks_created on public.buy_clicks (created_at desc);
create index buy_clicks_user on public.buy_clicks (user_id) where user_id is not null;
create index buy_clicks_job on public.buy_clicks (tryon_job_id) where tryon_job_id is not null;

alter table public.buy_clicks enable row level security;
revoke all on public.buy_clicks from anon, authenticated;
grant all on public.buy_clicks to service_role;
