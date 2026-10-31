-- Shared rate limits and retention for the full runtime. Room storage stays in
-- minint_app_snapshots, so existing rooms and host credentials remain unchanged.
create table if not exists public.minint_rate_limits (
 bucket text not null, key text not null, window_start bigint not null,
 hits integer not null default 1, primary key(bucket,key,window_start)
);
alter table public.minint_rate_limits enable row level security;
revoke all on public.minint_rate_limits from public,anon,authenticated;
grant select,insert,update,delete on public.minint_rate_limits to service_role;
create or replace function public.minint_hit_rate_limit(p_bucket text,p_key text,p_window_seconds integer,p_max integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare current_window bigint; current_hits integer;
begin
 if p_window_seconds<1 or p_max<1 or length(p_key)>200 then raise exception 'Invalid rate limit'; end if;
 current_window:=floor(extract(epoch from clock_timestamp())/p_window_seconds)::bigint*p_window_seconds;
 insert into public.minint_rate_limits(bucket,key,window_start,hits) values(p_bucket,p_key,current_window,1)
 on conflict(bucket,key,window_start) do update set hits=least(public.minint_rate_limits.hits+1,p_max+1)
 returning hits into current_hits;
 return current_hits<=p_max;
end;$$;
revoke all on function public.minint_hit_rate_limit(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.minint_hit_rate_limit(text,text,integer,integer) to service_role;
create table if not exists public.minint_security_events (
 id bigint generated always as identity primary key,kind text not null,app_id text,
 ip_hash text,detail jsonb,created_at timestamptz not null default now()
);
alter table public.minint_security_events enable row level security;
revoke all on public.minint_security_events from public,anon,authenticated;
grant select,insert on public.minint_security_events to service_role;
grant usage,select on sequence public.minint_security_events_id_seq to service_role;
create or replace function public.minint_cleanup() returns integer
language plpgsql security invoker set search_path='' as $$
declare removed integer;
begin
 delete from public.minint_app_snapshots where expires_at < now()-interval '10 minutes';
 get diagnostics removed=row_count;
 delete from public.minint_rate_limits where window_start < extract(epoch from now()-interval '1 day');
 delete from public.minint_security_events where created_at < now()-interval '30 days';
 return removed;
end;$$;
revoke all on function public.minint_cleanup() from public,anon,authenticated;
grant execute on function public.minint_cleanup() to service_role;
-- The scheduled SQL job is only installed when pg_cron is available on the project.
-- Otherwise call minint_cleanup through a service-role scheduled task.
do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  if not exists(select 1 from cron.job where jobname='minint-retention') then
   perform cron.schedule('minint-retention','*/10 * * * *','select public.minint_cleanup()');
  end if;
 end if;
end $$;
