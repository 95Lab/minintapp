-- One bounded aggregate per room keeps domain mutations, responses and version atomic.
-- No application records are exposed through Data API or Postgres Changes to browsers.
create table public.minint_app_snapshots (
  id text primary key check (id ~ '^[a-f0-9]{24}$'),
  version bigint not null check (version > 0),
  expires_at timestamptz not null,
  document jsonb not null,
  check (jsonb_typeof(document->'app') = 'object'),
  check (jsonb_typeof(document->'responses') = 'array'),
  check (jsonb_array_length(document->'responses') <= 1000),
  check (document->'app'->>'id' = id),
  check ((document->'app'->>'stateVersion')::bigint = version),
  check (document->'app'->>'realtimeChannel' ~ '^[a-f0-9]{64}$')
);
alter table public.minint_app_snapshots enable row level security;
revoke all on public.minint_app_snapshots from public, anon, authenticated;
grant select, insert, update, delete on public.minint_app_snapshots to service_role;

create function public.minint_storage_health() returns integer
language sql security invoker set search_path = '' as $$ select 1 $$;

create function public.minint_snapshot(p_id text) returns jsonb
language sql security invoker set search_path = '' as $$
  select jsonb_build_object('snapshot', s.document, 'now', floor(extract(epoch from clock_timestamp()) * 1000))
  from public.minint_app_snapshots s where s.id = p_id;
$$;

-- expected_version = 0 creates. All later writes compare the version under a row lock.
-- A conflict must rerun authorization and domain validation on a fresh snapshot.
create function public.minint_commit(p_id text, p_expected_version bigint, p_document jsonb, p_deadline_ms bigint default null)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  existing public.minint_app_snapshots%rowtype;
  next_version bigint := (p_document->'app'->>'stateVersion')::bigint;
  now_ms bigint;
begin
  if p_document->'app'->>'id' is distinct from p_id or next_version is distinct from p_expected_version + 1 then
    raise exception 'Invalid snapshot version';
  end if;
  if p_expected_version = 0 then
    insert into public.minint_app_snapshots(id, version, expires_at, document)
    values (p_id, next_version, to_timestamp((p_document->'app'->>'expiresAt')::double precision / 1000), p_document)
    on conflict (id) do nothing;
    if not found then return 'conflict'; end if;
    return 'ok';
  end if;
  select * into existing from public.minint_app_snapshots where id = p_id for update;
  if not found then return 'gone'; end if;
  if existing.version <> p_expected_version then return 'conflict'; end if;
  now_ms := floor(extract(epoch from clock_timestamp()) * 1000);
  if existing.expires_at <= clock_timestamp() or existing.document->'app'->>'status' in ('ended', 'blocked') then return 'gone'; end if;
  if p_deadline_ms is not null and now_ms > p_deadline_ms then return 'question_closed'; end if;
  if existing.document->'app'->>'realtimeChannel' is distinct from p_document->'app'->>'realtimeChannel'
    or existing.document->'app'->>'hostTokenHash' is distinct from p_document->'app'->>'hostTokenHash' then
    raise exception 'Immutable room credentials';
  end if;
  update public.minint_app_snapshots set version = next_version,
    expires_at = to_timestamp((p_document->'app'->>'expiresAt')::double precision / 1000), document = p_document where id = p_id;
  -- Broadcast invalidation only. Never send answers, credentials, names or spec here.
  -- Public topic is random 256-bit entropy and disclosed only through the room state API.
  perform realtime.send(jsonb_build_object('version', next_version), 'state_changed',
    'app:' || (p_document->'app'->>'realtimeChannel'), false);
  return 'ok';
end;
$$;

revoke all on function public.minint_snapshot(text) from public, anon, authenticated;
revoke all on function public.minint_commit(text, bigint, jsonb, bigint) from public, anon, authenticated;
revoke all on function public.minint_storage_health() from public, anon, authenticated;
grant execute on function public.minint_snapshot(text) to service_role;
grant execute on function public.minint_commit(text, bigint, jsonb, bigint) to service_role;
grant execute on function public.minint_storage_health() to service_role;

-- No publication of minint_app_snapshots: Realtime listens to its own broadcast WAL.
-- Optional retention job: delete ended/expired snapshots after the chosen retention period.
