# MinintApp — Deployment on a Shared VM

[Tiếng Việt](deployment.md) | [English](deployment.en.md)

## Status

The repository includes a CI/CD scaffold but no application source or Dockerfile. The workflow intentionally fails without a Dockerfile. Credentials, networks, Nginx changes, and server deployment have not been configured. Merge this branch into `main` before pushes to `main` can trigger the workflow.

## Deployment contract

- The app provides a Dockerfile, Node.js runtime, listens on `0.0.0.0:3000`, and returns HTTP 2xx from `/healthz` only when ready.
- The image runs as UID/GID 1000 with a read-only filesystem and writable `/tmp` only. Persistent backend data requires dedicated volumes and migrations compatible with rollback.
- The Compose project is fixed to `minintapp` and publishes only `127.0.0.1:18080`. Existing Nginx retains ports 80/443 and proxies MinintApp domains to this internal port. Prepare and validate Nginx/TLS configuration before enabling CI/CD.
- The owned network is `minintapp-platform`, with proposed subnet `172.30.240.0/24` and an ownership label. Preflight checks all Docker networks and IPv4 routes; conflicts stop deployment rather than modifying other networks. Docker allocates container IPs automatically; no static container IPs.
- The pipeline never runs `docker system prune`, deletes volumes, runs `compose down`, or restarts Docker/Nginx. The web service uses no host networking, privileged mode, or mounted Docker socket.
- Web limits are 1 CPU / 768 MiB RAM, bounded PIDs and logs; builds require at least 10 GiB free disk. Only one deployment runs at a time. Builds can still consume shared I/O/CPU; stronger resource guarantees require a separate build worker or validated dedicated cgroups.

A separate bridge is only part of isolation. Before executing user-generated Flash Apps, add gVisor, firewall/egress policies blocking the host, private networks, and other apps, aggregate sandbox quotas, and a locked subnet allocator that checks conflicts. This scaffold deploys only the platform web service; it does not create sandboxes or guarantee network isolation for untrusted code.

## One-time setup

1. Create a deploy user and appropriately owned `/opt/minintapp`. Docker access is effectively root-equivalent; grant it only to trusted deployment credentials. Do not reuse the personal SSH private key from this machine for CI.
2. Generate a dedicated CI key and authorize its public key for the deploy user. In GitHub Environment `production`, add secrets `DEPLOY_SSH_KEY` and `DEPLOY_KNOWN_HOSTS` (the host key for `[116.118.45.242]:2299`, fingerprint verified through a trusted channel).
3. Set environment variables `DEPLOY_HOST=116.118.45.242`, `DEPLOY_PORT=2299`, and `DEPLOY_USER=<deploy user>`.
4. Add source and a compatible Dockerfile; configure runtime secrets on the server and volumes when needed. Never include secrets in images or the git archive.
5. Validate subnets, resources, and Nginx; configure HTTPS/domains. Protect `main` and merge only reviewed changes.

## Update flow

Push/merge to `main` → validate contract → upload exact commit snapshot → acquire server deployment lock → check subnet/disk → build SHA-tagged image → update only the MinintApp project → health check → record current image.

On health-check failure, attempt to restore the previous image. Container recreation can cause downtime; this is not blue-green deployment. Rollback restores only the image using the current Compose configuration, not migrations, volumes, or configuration changes; schema/config changes require a separate rollback plan. A failed initial deployment stops the new web container. Old images and unrelated service data are never automatically pruned.

“Automatic sync” means uploading a commit snapshot, not overwriting a running checkout with `git pull`. Keep secrets and persistent data outside release directories.
