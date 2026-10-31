# MinintApp — Implemented Runtime Architecture

[Tiếng Việt](architecture-runtime.md) | [English](architecture-runtime.en.md)

## System boundaries

The original proposal is [architecture-design.en.md](../architecture-design.en.md). This implementation separates the Control and Runtime Planes for a one-VM demo, with contracts for placing apps across workers. `/api/apps/*` and `/api/engine/*` share the repository boundary; the extended engine, Supabase adapter, and existing UI are retained.

| Component | Source | Responsibility |
|---|---|---|
| Control Plane | `src/lib/control-plane/` | Tenants, quotas, deployment creation, management APIs |
| Metadata | `platform/schema.sql`, `platform/store.ts` | PostgreSQL deployments, workers, versions, outbox, state history |
| Queue / Scheduler | `platform/scheduler.ts` | BullMQ, transactional reservations, heartbeat and cached-image filtering |
| Builder | `platform/build-spec.ts` | OpenAI, moderation/validation, versioned AppSpec manifests |
| Worker Agent | `platform/worker.ts` | Provisioning, health checks, TTL, backups, private RPC |
| Sandbox | `platform/docker-runtime.ts` | gVisor, dedicated networks/volumes/ports, quotas, firewall |
| Gateway | `platform/gateway*.ts` | Traefik file provider, hostname routing, multiple-worker synchronization |
| DNS | `platform/cloudflare.ts` | Ownership-tagged records; writes disabled by default |
| App data | `src/lib/runtime-plane/` | One PostgreSQL database and role per app |
| Artifacts / backups | `platform/artifacts.ts`, `platform/backup.ts` | Manifests and consistent JSONB snapshots on S3-compatible storage |

## App creation flow

1. The browser holds a tenant capability in an HttpOnly cookie; HTTPS uses the `__Host-` prefix. Verified Supabase accounts remain supported through the engine.
2. The Control Plane persists the deployment, host-token hash, image digest, TTL, and idempotency key. It returns `202`; the frontend follows deployment status before opening the app. Engine generation retains NDJSON progress.
3. The dispatcher delivers the outbox to BullMQ with deterministic job IDs. A crash after enqueue does not duplicate jobs.
4. The Scheduler reserves capacity under a transaction lock, selecting only workers with fresh heartbeats, spare capacity, and the exact cached image digest.
5. The Builder generates/validates AppSpec. The artifact is an **immutable template image plus an AppSpec manifest**; it does not run npm builds for arbitrary generated backend code. `BUILDING` packages the manifest. A temporary build-sandbox pipeline for untrusted code is a separate extension and is not enabled.
6. The Agent creates the sandbox and dedicated PostgreSQL database/role, checks health, publishes routing and approved DNS, and marks `RUNNING` only after internal gateway and public HTTPS checks identify the correct app.

## Isolation and data

- Runtimes receive only their own seed and capability, never OpenAI, Cloudflare, S3, shared database credentials, or the Docker socket.
- Containers run non-root under `runsc`, with read-only filesystems, bounded `/tmp`, 0.5 CPU/512 MiB, and PID/log limits and a 16 MiB snapshot limit. One replica per app.
- Each app has its own bridge, with IPv6 and external DNS disabled. Subnets are checked against Docker and all IPv4 routes; loopback ports are checked against listening sockets and container reservations and remain fixed across restarts.
- INPUT and DOCKER-USER rules match only that app's bridge, blocking NEW connections to the host/other networks without changing existing apps' firewall policies. Missing runsc never falls back to runc.
- Provisioning preserves at least 1.5 GiB available host RAM and 10 GiB disk. Defaults: three apps per VM, three globally, two per tenant. Validate these limits under real load.
- Each app has an `app_<id>` database and login role with CONNECT only to that database, schema USAGE, and SELECT/UPDATE on its snapshot. The admin owns databases/tables; apps cannot perform DDL, switch roles, or access metadata/other app databases. PostgreSQL row locks and transactions serialize writes; CAS preserves `stateVersion` and immutable app/host identity. Database failures never fall back to memory/SQLite.
- Consistent JSONB snapshots are uploaded privately every five minutes. Expiration removes runtime/routes/DNS, retains the database for 24 hours, then deletes the database, role, and artifacts. Legacy SQLite volumes are retained separately after migration for controlled rollback. Explicit deletion bypasses retention. Image rollback cannot restore deleted data.

## Credentials and DNS

systemd loads `/root/.config/ai-secrets/api.env` through `EnvironmentFile`; the Worker uses only `process.env` and does not read secrets files itself. Compose injects only the credentials needed by each service. No API-key copy files are created. The Control Plane receives only necessary internal credentials through environment injection; sandboxes receive no platform keys.

Internal secrets `DATABASE_URL`, `REDIS_URL`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `WORKER_TOKEN`, `IP_HASH_SALT`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` live in the same central file, never Git or logs. Rotating the worker token requires rolling out existing runtime capabilities, not merely restarting the agent.

`DNS_AUTOMATION_APPROVED` defaults to false. The owner approved the demo ingress A record, 24-hex app CNAMEs under `minintapp.io.vn`, and temporary ACME TXT records for wildcard issuance/renewal. Other records must remain unchanged. `deploy/acme-cloudflare.py` touches only TXT records matching its validation content and ownership marker.

## Deployment and multiple VMs

`deploy/platform.compose.yml` overlays the existing web Compose configuration. PostgreSQL, Redis, and MinIO have dedicated volumes. Redis/MinIO bind loopback only; PostgreSQL also binds the private platform bridge gateway for sandboxes, never the public IP. Existing Nginx retains 80/443 and forwards app hostnames to Traefik on loopback 18081. The Agent binds a bridge/private IP on 19090 and requires a bearer token.

CI builds and tests images on GitHub. Images contain the Worker bundle and schema; the SSH gate accepts only this repository's digests. With `.platform-enabled`, deployment updates Worker and web, checks health, and promotes or attempts rollback of both. Database, queue, object storage, and app sandboxes are not force-recreated on each commit.

**Trust boundary:** main and the GHCR publisher are trusted administrative code. The Worker is privileged to manage Docker/firewall rules; replacing its bundle executes privileged server code. Restricted SSH commands do not make untrusted main code safe. Protect main/package write access and deployment secrets.

To add a VM: prepare runsc, Agent and gateway; use centrally managed credentials; connect PostgreSQL/Redis/S3 over a private network; cache approved images; register a unique worker ID; allowlist Agent/gateway URLs. The edge worker synchronizes routes to the gateway of the VM hosting each app. Automatic VM provisioning, live volume migration, Control Plane HA, and automatic recovery from worker data loss are not implemented. Fence the old writer and restore a backup before starting a writable replacement elsewhere.

## Verification

```sh
npm run env:check
npm run check
npm run build:worker
npm run test:e2e
docker compose -p minintapp-refine-tests -f deploy/test.compose.yml up -d --wait
npm run test:platform
LOCAL_RUNTIME_IMAGE=minintapp-refine:local npm run smoke:runtime
```

`test:storage` requires a separate test MinIO on loopback 19009 and a built Worker bundle, using fixture credentials rather than production keys. Live Supabase tests remain in `vitest.supabase.config.ts` and must not be reported as verified without a real Supabase connection.

Remaining limits: anonymous tenants are browser-bound; marketplace/payments are not implemented; sandbox live-data outbound access is blocked by default and requires an egress proxy before enabling it. Multiple VMs have placement/routing contracts; the live demo still uses one VM. See [Business Flow](../business-flow.en.md) for the commercial roadmap.

References: [gVisor installation](https://gvisor.dev/docs/user_guide/install/), [Docker firewall](https://docs.docker.com/engine/network/firewall-iptables/), [Traefik file provider](https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/).

## Activated demo (2026-10-31)

The platform profile is enabled on the demo VM; the Worker receives the OpenAI key through systemd environment injection. The Control Plane does not hold the AI key. Live checks verified OpenAI generation, two gVisor sandboxes with separate HTTPS subdomains, and votes surviving restart and suspend/resume while the other app remained available. This validates one VM, not multi-VM HA.

Gateway probes use an HTTP request that preserves `Host` to check the intended app. AI expression schemas use a finite `$defs`/`$ref` chain, preserving expression depth while avoiding excessive inline nesting in Structured Outputs. Integration status reads AI configuration from allowlisted Workers rather than the web key. Template creation quota errors return JSON following the API contract.

## PostgreSQL migration

`deploy/migrate-environment.mjs <file>` normalizes legacy internal variable names in place, creates standard URLs, and preserves API keys. The file remains 0600; keys are not copied into the repository/deployment directory. Certbot receives its environment through `deploy/certbot-environment.conf`.

Stop only the dedicated Worker before running `migrate-runtime-postgres.mjs <app-id> <image-digest>`. The script verifies ownership, stops the source runtime, reads a consistent SQLite snapshot from its read-only volume, backs it up privately, imports PostgreSQL, and compares the entire snapshot. It promotes the image after health checks and restores the legacy container on failure. Source volumes are retained. Migrate apps sequentially, then start the Worker. Never run this script against a database cluster shared with unrelated services.

Database roles isolate data privileges, not PostgreSQL physical resources. Default connection limits/timeouts do not provide hard CPU/IO quotas for untrusted SQL. The independent `runtime/poll/` prototype remains a SQLite experiment outside the scheduler; platform-provisioned sandboxes use PostgreSQL.
