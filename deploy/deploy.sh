#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
image=${1:?Usage: bash deploy.sh ghcr.io/owner/image@sha256:digest}
if [[ ! "$image" =~ ^ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$ ]]; then
  echo 'Expected an immutable GHCR image digest.' >&2
  exit 1
fi
for command in docker curl flock; do command -v "$command" >/dev/null || { echo "Missing $command" >&2; exit 1; }; done
[[ -f .env && -f .env.app ]] || { echo 'Create .env and .env.app on the VPS first.' >&2; exit 1; }
# Serialize manual and automated deploys on this VPS.
exec 9>.deploy.lock
flock -n 9 || { echo 'Another deploy is running.' >&2; exit 1; }
origin=$(sed -n 's/^APP_ORIGIN=//p' .env)
[[ "$origin" =~ ^https?://[a-zA-Z0-9.-]+(:[0-9]+)?$ ]] || { echo 'APP_ORIGIN must be a bare HTTP(S) origin, without quotes or trailing slash.' >&2; exit 1; }
candidate=$(mktemp .image.next.XXXXXX)
trap 'rm -f -- "$candidate"' EXIT
printf 'MININTAPP_IMAGE=%s\n' "$image" > "$candidate"
compose() { local file=$1; shift; docker compose --env-file .env --env-file "$file" -f compose.yml -p minintapp "$@"; }
# Fail before touching the running stack if configuration, pull or proxy validation fails.
compose "$candidate" config --quiet
python3 ./network-preflight.py
compose "$candidate" pull app

rollback() {
  if [[ -f .image.env ]]; then
    echo 'Deploy failed; restoring the previous application image.' >&2
    if ! compose .image.env up -d --force-recreate --wait --wait-timeout 120; then
      echo 'ROLLBACK FAILED: inspect docker compose logs on the VPS.' >&2
    fi
  else
    echo 'First deploy failed; no previous application image exists.' >&2
    compose "$candidate" stop app || true
  fi
  exit 1
}
if ! compose "$candidate" up -d --force-recreate --wait --wait-timeout 120; then rollback; fi
# Test the public proxy/TLS path too. Retry while the first TLS certificate is issued.
if ! curl --fail --silent --show-error --retry 12 --retry-delay 5 --retry-all-errors --retry-max-time 90 --max-time 5 "$origin/api/health" | grep -q '"service":"minintapp"'; then rollback; fi
if [[ -f .image.env ]]; then cp .image.env .image.previous.env; fi
mv -- "$candidate" .image.env
printf 'Deployed %s\n' "$image"
