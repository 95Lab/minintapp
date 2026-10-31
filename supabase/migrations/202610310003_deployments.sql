-- Control-plane metadata only. This table does not provision or stop workloads.
-- No FK to app snapshots: deployment cleanup must remain possible after app retention purges.
create table public.minint_deployments (
  id text primary key check (id ~ '^[a-f0-9]{24}$'),
  app_id text not null check (app_id ~ '^[a-f0-9]{24}$'),
  idempotency_key text not null,
  hostname text not null check (length(hostname) <= 253 and hostname ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$'),
  version bigint not null check (version > 0),
  state text not null check (state in ('QUEUED','GENERATING','BUILDING','DEPLOYING','RUNNING','FAILED','SUSPENDED','EXPIRED','DELETED')),
  expires_at timestamptz not null,
  document jsonb not null,
  unique (app_id, idempotency_key),
  check (document->>'id' = id and document->>'appId' = app_id and document->>'hostname' = hostname and document->>'idempotencyKey' = idempotency_key),
  check ((document->>'version')::bigint = version and document->>'state' = state),
  check ((document->'job'->>'attempt')::integer between 0 and (document->>'maxAttempts')::integer),
  check ((document->>'maxAttempts')::integer between 1 and 10 and document->'job'->>'maxAttempts' = document->>'maxAttempts'),
  check (jsonb_typeof(document->'errors') = 'array' and jsonb_array_length(document->'errors') <= 10),
  check (state <> 'QUEUED' or document->'job'->>'status' = 'QUEUED'),
  check (state not in ('GENERATING','BUILDING','DEPLOYING') or (document->'job'->>'status' = 'RUNNING' and document->>'workerId' is not null and document->'job'->>'startedAt' is not null and (document->'job'->>'attempt')::integer > 0)),
  check (state not in ('RUNNING','SUSPENDED') or (document->'job'->>'status' = 'SUCCEEDED' and document->>'sandboxId' is not null and document->>'volumeId' is not null and document->>'workerId' is not null and document->>'dnsRecordId' is not null)),
  check (state <> 'RUNNING' or document->>'gatewayVerifiedAt' is not null),
  check (state not in ('DEPLOYING','RUNNING','SUSPENDED') or document->>'imageRef' ~ '^[a-z0-9]+([._-][a-z0-9]+)*(:[0-9]{1,5})?(/[a-z0-9]+([._-][a-z0-9]+)*)+@sha256:[a-f0-9]{64}$'),
  check (state <> 'FAILED' or (document->'job'->>'status' = 'FAILED' and document->>'lastError' is not null)),
  check (document->'job'->>'status' not in ('SUCCEEDED','FAILED','CANCELLED') or document->'job'->>'finishedAt' is not null),
  check ((state = 'DELETED') = (document->>'deletedAt' is not null))
);
create unique index minint_deployments_hostname on public.minint_deployments(hostname) where state <> 'DELETED';
create index minint_deployments_app on public.minint_deployments(app_id);
create index minint_deployments_expiry on public.minint_deployments(expires_at) where state not in ('EXPIRED','DELETED');
alter table public.minint_deployments enable row level security;
revoke all on public.minint_deployments from public, anon, authenticated;
grant select, insert, update, delete on public.minint_deployments to service_role;

create function public.minint_deployment_read(p_id text) returns jsonb
language sql security invoker set search_path = '' as $$
  select jsonb_build_object('deployment', d.document, 'now', floor(extract(epoch from clock_timestamp()) * 1000))
  from public.minint_deployments d where d.id = p_id;
$$;
create function public.minint_deployment_list(p_app_id text) returns jsonb
language sql security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(d.document order by (d.document->>'createdAt')::bigint desc, d.id), '[]'::jsonb)
  from public.minint_deployments d where d.app_id = p_app_id;
$$;
create function public.minint_deployment_create(p_document jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare existing public.minint_deployments%rowtype; now_ms bigint;
begin
  -- Serializes a retried create across Node processes, including a lost HTTP response.
  perform pg_advisory_xact_lock(hashtextextended((p_document->>'appId') || ':' || (p_document->>'idempotencyKey'), 0));
  select * into existing from public.minint_deployments
    where app_id = p_document->>'appId' and idempotency_key = p_document->>'idempotencyKey';
  if found then
    if (existing.document - array['id','version','state','imageRef','workerId','sandboxId','volumeId','dnsRecordId','gatewayVerifiedAt','deletedAt','createdAt','updatedAt','job','lastError','errors'])
      is distinct from (p_document - array['id','version','state','imageRef','workerId','sandboxId','volumeId','dnsRecordId','gatewayVerifiedAt','deletedAt','createdAt','updatedAt','job','lastError','errors']) then
      return jsonb_build_object('outcome','idempotency_conflict');
    end if;
    return jsonb_build_object('outcome','existing','deployment',existing.document);
  end if;
  now_ms := floor(extract(epoch from clock_timestamp()) * 1000);
  if (p_document->>'expiresAt')::bigint <= now_ms then return jsonb_build_object('outcome','expired'); end if;
  if p_document->>'state' is distinct from 'QUEUED' or (p_document->>'version')::bigint is distinct from 1
    or p_document->'job'->>'status' is distinct from 'QUEUED' or (p_document->'job'->>'attempt')::integer is distinct from 0 then raise exception 'Invalid initial deployment'; end if;
  p_document := p_document || jsonb_build_object('createdAt',now_ms,'updatedAt',now_ms);
  begin
    insert into public.minint_deployments(id,app_id,idempotency_key,hostname,version,state,expires_at,document)
    values(p_document->>'id',p_document->>'appId',p_document->>'idempotencyKey',p_document->>'hostname',1,'QUEUED',to_timestamp((p_document->>'expiresAt')::double precision/1000),p_document);
  exception when unique_violation then
    if exists(select 1 from public.minint_deployments where hostname = p_document->>'hostname' and state <> 'DELETED') then
      return jsonb_build_object('outcome','hostname_conflict');
    end if;
    raise;
  end;
  return jsonb_build_object('outcome','created','deployment',p_document);
end;
$$;

create function public.minint_deployment_commit(p_id text,p_expected_version bigint,p_document jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare existing public.minint_deployments%rowtype; next_state text := p_document->>'state'; now_ms bigint;
begin
  select * into existing from public.minint_deployments where id = p_id for update;
  if not found then return jsonb_build_object('outcome','not_found'); end if;
  if existing.version <> p_expected_version then return jsonb_build_object('outcome','version_conflict'); end if;
  if (p_document->>'version')::bigint is distinct from p_expected_version+1 or
    (existing.document - array['version','state','imageRef','workerId','sandboxId','volumeId','dnsRecordId','gatewayVerifiedAt','deletedAt','updatedAt','job','lastError','errors']) is distinct from
    (p_document - array['version','state','imageRef','workerId','sandboxId','volumeId','dnsRecordId','gatewayVerifiedAt','deletedAt','updatedAt','job','lastError','errors'])
    or existing.document->'job'->>'id' is distinct from p_document->'job'->>'id' then raise exception 'Immutable deployment identity'; end if;
  if not (
    (existing.state = 'QUEUED' and next_state in ('GENERATING','EXPIRED')) or
    (existing.state = 'GENERATING' and next_state in ('BUILDING','FAILED','EXPIRED')) or
    (existing.state = 'BUILDING' and next_state in ('DEPLOYING','FAILED','EXPIRED')) or
    (existing.state = 'DEPLOYING' and next_state in ('DEPLOYING','RUNNING','FAILED','EXPIRED')) or
    (existing.state = 'RUNNING' and next_state in ('SUSPENDED','EXPIRED')) or
    (existing.state = 'SUSPENDED' and next_state in ('RUNNING','EXPIRED','DELETED')) or
    (existing.state = 'FAILED' and next_state in ('QUEUED','EXPIRED','DELETED')) or
    (existing.state = 'EXPIRED' and next_state = 'DELETED')
  ) then raise exception 'Invalid deployment transition'; end if;
  now_ms := floor(extract(epoch from clock_timestamp()) * 1000);
  if next_state = 'EXPIRED' and existing.expires_at > clock_timestamp() then raise exception 'Deployment not expired'; end if;
  if existing.expires_at <= clock_timestamp() and next_state not in ('EXPIRED','DELETED') then return jsonb_build_object('outcome','expired'); end if;
  if next_state = 'QUEUED' and (existing.document->'lastError'->>'retryable' is distinct from 'true' or (existing.document->'job'->>'attempt')::integer >= (existing.document->>'maxAttempts')::integer) then raise exception 'Retry not allowed'; end if;
  if existing.document->>'sandboxId' is not null and (
    existing.document->>'sandboxId' is distinct from p_document->>'sandboxId' or existing.document->>'workerId' is distinct from p_document->>'workerId' or existing.document->>'imageRef' is distinct from p_document->>'imageRef'
  ) then raise exception 'Reserved sandbox changed'; end if;
  if (existing.document->>'volumeId' is not null and existing.document->>'volumeId' is distinct from p_document->>'volumeId') or
    (existing.document->>'dnsRecordId' is not null and existing.document->>'dnsRecordId' is distinct from p_document->>'dnsRecordId') then raise exception 'Reserved resource changed'; end if;
  if (p_document->'job'->>'attempt')::integer is distinct from (existing.document->'job'->>'attempt')::integer + case when next_state = 'GENERATING' then 1 else 0 end then raise exception 'Invalid attempt counter'; end if;
  p_document := p_document || jsonb_build_object('updatedAt',now_ms);
  update public.minint_deployments set version = p_expected_version+1,state = next_state,document = p_document where id = p_id;
  return jsonb_build_object('outcome','ok','deployment',p_document);
end;
$$;
revoke all on function public.minint_deployment_read(text) from public, anon, authenticated;
revoke all on function public.minint_deployment_list(text) from public, anon, authenticated;
revoke all on function public.minint_deployment_create(jsonb) from public, anon, authenticated;
revoke all on function public.minint_deployment_commit(text,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.minint_deployment_read(text) to service_role;
grant execute on function public.minint_deployment_list(text) to service_role;
grant execute on function public.minint_deployment_create(jsonb) to service_role;
grant execute on function public.minint_deployment_commit(text,bigint,jsonb) to service_role;
