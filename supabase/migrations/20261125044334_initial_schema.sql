-- Step 1.2: Stage 1 schema (PROJECT-PLAN §4) with row-level security and storage buckets.
--
-- Security model
--   * The browser (roles anon / authenticated) can read its own rows and change only harmless
--     columns (profile details, which photo is primary, a try-on rating).
--   * Anything that must be trusted or costs money is written only by server routes using the
--     secret key (role service_role, which bypasses RLS): photo status after moderation,
--     try-on jobs, consents (they record the request IP), photo/result files.
--   * Privileges are granted explicitly, column by column where it matters, so the result does
--     not depend on the project's default grants.

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------------------------
-- profiles: one row per auth user, created by trigger
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  display_name          text check (char_length(display_name) <= 80),
  is_adult_confirmed_at timestamptz,
  preferred_units       text not null default 'imperial' check (preferred_units in ('metric', 'imperial')),
  height_cm             numeric(5, 1) check (height_cm between 50 and 260),
  weight_kg             numeric(5, 1) check (weight_kg between 20 and 400),
  chest_cm              numeric(5, 1) check (chest_cm between 40 and 250),
  waist_cm              numeric(5, 1) check (waist_cm between 40 and 250),
  hips_cm               numeric(5, 1) check (hips_cm between 40 and 250),
  role                  text not null default 'user' check (role in ('user', 'admin')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Every new auth user gets a profile row.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Used by policies. security definer so it can read profiles without recursing into RLS.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- consents: one row per consent given (legal evidence); written by the server only
-- ---------------------------------------------------------------------------------------------

create table public.consents (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  type        text not null check (type in ('age_18_plus', 'terms', 'privacy', 'body_photo')),
  version     text not null,
  accepted_at timestamptz not null default now(),
  ip          inet
);

create index consents_user_type on public.consents (user_id, type);

-- ---------------------------------------------------------------------------------------------
-- user_photos: max 5 per user (rejected ones don't count); files live in bucket user-photos
-- ---------------------------------------------------------------------------------------------

create table public.user_photos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  storage_path  text not null unique,
  status        text not null default 'pending' check (status in ('pending', 'ready', 'rejected')),
  reject_reason text,
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, user_id) -- lets tryon_jobs prove the photo belongs to the same user
);

create index user_photos_user on public.user_photos (user_id);
create unique index user_photos_one_primary on public.user_photos (user_id) where is_primary;

create trigger user_photos_updated_at before update on public.user_photos
  for each row execute function public.set_updated_at();

create function public.enforce_photo_limit() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'rejected' then
    return new;
  end if;
  -- Serialise concurrent uploads by the same user.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if (select count(*) from public.user_photos
      where user_id = new.user_id and status <> 'rejected' and id <> new.id) >= 5 then
    raise exception 'photo limit reached (5)' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger user_photos_limit before insert or update of status on public.user_photos
  for each row execute function public.enforce_photo_limit();

-- Makes one ready photo the primary one, in a single call (runs with the caller's rights).
create function public.set_primary_photo(photo_id uuid) returns void
language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.user_photos
    where id = photo_id and user_id = (select auth.uid()) and status = 'ready'
  ) then
    raise exception 'photo not found' using errcode = 'no_data_found';
  end if;
  update public.user_photos set is_primary = false
    where user_id = (select auth.uid()) and is_primary and id <> photo_id;
  update public.user_photos set is_primary = true where id = photo_id;
end $$;

-- ---------------------------------------------------------------------------------------------
-- products: public catalog; only published products are visible, only admins write
-- ---------------------------------------------------------------------------------------------

create table public.products (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  shop_name        text not null,
  name             text not null,
  description      text not null default '',
  price_cents      integer not null check (price_cents >= 0),
  currency         text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  garment_type     text not null check (garment_type in ('top', 'bottom', 'one_piece')),
  tryon_image_path text,             -- clean front-view garment image the AI uses (bucket product-images)
  gallery_paths    text[] not null default '{}',
  sizes            text[] not null default '{}',
  size_chart       jsonb not null default '{}'::jsonb,
  buy_url          text check (buy_url ~ '^https://'),
  status           text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Decision A3: no publishing without a try-on image; no publishing without somewhere to buy.
  constraint products_publishable
    check (status <> 'published' or (tryon_image_path is not null and buy_url is not null))
);

create index products_published on public.products (garment_type, created_at desc) where status = 'published';

create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- tryon_jobs: created and advanced by the server; the user may only rate their own results
-- ---------------------------------------------------------------------------------------------

create table public.tryon_jobs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  photo_id        uuid not null,
  product_id      uuid not null references public.products (id) on delete restrict,
  provider        text not null,
  provider_job_id text,
  status          text not null default 'queued' check (status in ('queued', 'processing', 'done', 'failed')),
  result_path     text,
  error_code      text,
  cost_cents      numeric(10, 2) check (cost_cents >= 0), -- e.g. 7.50 for $0.075
  rating          smallint check (rating in (-1, 1)),
  created_at      timestamptz not null default now(),
  finished_at     timestamptz,
  foreign key (photo_id, user_id) references public.user_photos (id, user_id) on delete cascade,
  constraint tryon_jobs_done_has_result check (status <> 'done' or result_path is not null)
);

-- The cache: one successful result per (photo, product, provider).
create unique index tryon_jobs_cache on public.tryon_jobs (photo_id, product_id, provider) where status = 'done';
-- No double charge from a double click: one job in flight per (photo, product, provider).
create unique index tryon_jobs_in_flight on public.tryon_jobs (photo_id, product_id, provider)
  where status in ('queued', 'processing');
create index tryon_jobs_user_created on public.tryon_jobs (user_id, created_at desc);
create index tryon_jobs_open on public.tryon_jobs (created_at) where status in ('queued', 'processing');
create index tryon_jobs_product on public.tryon_jobs (product_id);

-- ---------------------------------------------------------------------------------------------
-- Privileges (explicit) and row-level security
-- ---------------------------------------------------------------------------------------------

alter table public.profiles    enable row level security;
alter table public.consents    enable row level security;
alter table public.user_photos enable row level security;
alter table public.products    enable row level security;
alter table public.tryon_jobs  enable row level security;

revoke all on public.profiles, public.consents, public.user_photos, public.products, public.tryon_jobs
  from anon, authenticated;
grant all on public.profiles, public.consents, public.user_photos, public.products, public.tryon_jobs
  to service_role;

revoke execute on function public.set_updated_at(), public.handle_new_user(), public.enforce_photo_limit(),
  public.is_admin(), public.set_primary_photo(uuid) from public, anon, authenticated;
grant execute on function public.is_admin(), public.set_primary_photo(uuid) to authenticated;

-- profiles: read own; edit own details (not role, not the adult confirmation)
grant select on public.profiles to authenticated;
grant update (display_name, preferred_units, height_cm, weight_kg, chest_cm, waist_cm, hips_cm)
  on public.profiles to authenticated;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- consents: read own
grant select on public.consents to authenticated;

create policy "consents: read own" on public.consents
  for select to authenticated using (user_id = (select auth.uid()));

-- user_photos: read own; choose the primary photo
grant select on public.user_photos to authenticated;
grant update (is_primary) on public.user_photos to authenticated;

create policy "user_photos: read own" on public.user_photos
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user_photos: update own" on public.user_photos
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- products: everyone reads published; admins read and write everything
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

create policy "products: read published" on public.products
  for select to anon, authenticated using (status = 'published');
create policy "products: admin read all" on public.products
  for select to authenticated using ((select public.is_admin()));
create policy "products: admin insert" on public.products
  for insert to authenticated with check ((select public.is_admin()));
create policy "products: admin update" on public.products
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "products: admin delete" on public.products
  for delete to authenticated using ((select public.is_admin()));

-- tryon_jobs: read own; rate own
grant select on public.tryon_jobs to authenticated;
grant update (rating) on public.tryon_jobs to authenticated;

create policy "tryon_jobs: read own" on public.tryon_jobs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "tryon_jobs: rate own" on public.tryon_jobs
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- Storage buckets
--   user-photos/<user_id>/<photo_id>.jpg     private, uploaded by the server after moderation
--   tryon-results/<user_id>/<job_id>.jpg     private, written by the server
--   product-images/...                       public, written by admins
-- The browser shows private files through short-lived signed URLs made by the server.
-- ---------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('user-photos',    'user-photos',    false, 10485760, array['image/jpeg']),
  ('tryon-results',  'tryon-results',  false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('product-images', 'product-images', true,  10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "user files: read own folder" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('user-photos', 'tryon-results')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "product images: admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "product images: admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()))
  with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "product images: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
