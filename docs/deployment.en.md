# Deploying MinintApp on a Shared VM

[Tiếng Việt](deployment.md) | [English](deployment.en.md)

## Deployment flow

Push to `main` → typecheck/unit/build/E2E → build and smoke-test image on GitHub → publish digest to GHCR → SSH as `minintapp-deploy` → pull image → internal and public HTTPS health checks → promote or roll back.

No self-hosted runner is required. Builds do not run on the VM. The default `APP_STORAGE=memory` loses apps and votes on deploy/restart/rollback. For persistence, set `APP_STORAGE=supabase` and the Supabase keys in `deploy/.env.app`, then apply the migration described in [Supabase setup](supabase.md). These are runtime settings; no image rebuild is required. Without an AI key, use template creation; do not present it as real AI generation.

## Server isolation

Existing Nginx retains 80/443; MinintApp binds only `127.0.0.1:18080`. Compose project: `minintapp`; network: `minintapp-platform`; subnet: `172.30.240.0/24`. Preflight checks Docker networks and routes before deployment and stops on conflicts. Docker allocates IPs. App limits: 1 CPU/768 MiB RAM and bounded logs. No Docker restarts, pruning, or changes to other stacks.

This deploys the platform web app using its current shared runtime, not a separate sandbox for every Flash App. Untrusted generated code requires gVisor, egress controls, and sandbox quotas. A separate network is not a complete security boundary.

## Credentials

Repository secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`. Variables: `VPS_PORT=2299`, `DEPLOY_ENABLED=true` only after bootstrap. Environment: `production`.

The dedicated CI key cannot log in as root, open a shell, upload files, or call arbitrary Docker commands. Its authorized key uses a forced command; sudo permits only the root-owned `/usr/local/sbin/minintapp-ssh-gate`, which accepts only `deploy ghcr.io/95lab/minintapp@sha256:<64 hex>`. This credential can replace the MinintApp application; grant it only to trusted main workflows. GHCR credentials arrive over stdin; temporary Docker configuration is removed afterward.

## Bootstrap and infrastructure changes

An administrator installs `deploy/compose.yml`, `deploy/deploy.sh`, and `deploy/network-preflight.py` into `/opt/minintapp`, and `deploy/ssh-gate.sh` as `/usr/local/sbin/minintapp-ssh-gate`, all root-owned. The CI user cannot edit these files and is not in the Docker group. Create the network after successful preflight; configure the Nginx domain and TLS certificate. Store runtime secrets in mode-600 `.env.app`; `.env` contains `APP_ORIGIN=https://minintapp.io.vn`.

The pipeline updates only the application image, not root-owned infrastructure files. Compose/gate/deployment script changes require administrator review and installation before enabling the corresponding workflow. Do not use `scripts/deploy-runner.sh` for this SSH setup.

## Verification and rollback

`curl --fail https://minintapp.io.vn/api/health` must report service `minintapp`. Promote only after internal and public health checks pass. Failures trigger an attempt to restore the previous image; failed initial deployments stop the app. Recreation causes downtime. Rollback does not restore memory, migrations, or infrastructure configuration.

Certbot manages origin certificates; the renewal hook validates and reloads Nginx. Keep the HTTP ACME route for renewal. The pipeline does not change Cloudflare DNS/TLS policies.
