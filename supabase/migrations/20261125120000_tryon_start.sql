-- Step 1.7: starting a try-on job safely.
--
-- One call decides, under a lock, whether a request is served from the cache, joins a job already
-- running, is over a daily limit, or creates a new job. Doing this in one locked step means two
-- clicks at once can never both pass the limit check or both pay the provider.

-- How many times the provider has been asked (1 = first try, 2 = the one automatic retry).
alter table public.tryon_jobs add column attempts smallint not null default 1 check (attempts between 1 and 5);

create function public.start_tryon_job(
  p_user_id    uuid,
  p_photo_id   uuid,
  p_product_id uuid,
  p_provider   text,
  p_user_limit integer, -- new try-ons per user in the last 24 hours (null = no limit)
  p_global_cap integer  -- new try-ons for everyone in the last 24 hours (null = no cap)
) returns table (job_id uuid, outcome text) -- outcome: cached | in_flight | created | user_limit | global_cap
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  -- One request at a time decides; at this scale a single lock is simplest and cheap.
  perform pg_advisory_xact_lock(hashtextextended('start_tryon_job', 0));

  -- Jobs stuck for more than 3 minutes would block this photo and product forever; fail them first.
  update public.tryon_jobs
     set status = 'failed', error_code = 'timeout', finished_at = now()
   where photo_id = p_photo_id and product_id = p_product_id and provider = p_provider
     and status in ('queued', 'processing') and created_at < now() - interval '3 minutes';

  select id into v_id from public.tryon_jobs
   where photo_id = p_photo_id and product_id = p_product_id and provider = p_provider
     and user_id = p_user_id and status = 'done';
  if found then
    return query select v_id, 'cached'::text; return;
  end if;

  select id into v_id from public.tryon_jobs
   where photo_id = p_photo_id and product_id = p_product_id and provider = p_provider
     and user_id = p_user_id and status in ('queued', 'processing');
  if found then
    return query select v_id, 'in_flight'::text; return;
  end if;

  -- Failed jobs cost nothing and do not count.
  if p_user_limit is not null and (
    select count(*) from public.tryon_jobs
     where user_id = p_user_id and status <> 'failed' and created_at > now() - interval '24 hours'
  ) >= p_user_limit then
    return query select null::uuid, 'user_limit'::text; return;
  end if;

  if p_global_cap is not null and (
    select count(*) from public.tryon_jobs
     where status <> 'failed' and created_at > now() - interval '24 hours'
  ) >= p_global_cap then
    return query select null::uuid, 'global_cap'::text; return;
  end if;

  insert into public.tryon_jobs (user_id, photo_id, product_id, provider)
  values (p_user_id, p_photo_id, p_product_id, p_provider)
  returning id into v_id;
  return query select v_id, 'created'::text;
end $$;

-- Only the server (secret key) may start jobs: they cost money.
revoke execute on function public.start_tryon_job(uuid, uuid, uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.start_tryon_job(uuid, uuid, uuid, text, integer, integer) to service_role;
