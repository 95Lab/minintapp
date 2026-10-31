#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
: "${IMAGE_REF:?Missing IMAGE_REF}" "${GHCR_TOKEN:?Missing GHCR_TOKEN}" "${GHCR_USER:?Missing GHCR_USER}"
app_dir=${DEPLOY_APP_DIR:-/opt/minintapp}
[[ "$app_dir" = /* && "$app_dir" != / ]] || { echo 'DEPLOY_APP_DIR must be an absolute application directory.' >&2; exit 1; }
[[ "$IMAGE_REF" =~ ^ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$ ]] || { echo 'Invalid image digest.' >&2; exit 1; }
for command in docker curl flock; do command -v "$command" >/dev/null || { echo "Missing $command" >&2; exit 1; }; done
repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
[[ -d "$app_dir" ]] || { echo 'Create the deployment directory on the runner first.' >&2; exit 1; }
app_dir=$(cd -- "$app_dir" && pwd -P)
[[ "$app_dir" != "$repo_dir" && "$app_dir" != "$repo_dir/"* ]] || { echo 'Keep deployment files outside the runner checkout directory.' >&2; exit 1; }
[[ -f "$app_dir/.env" && -f "$app_dir/.env.app" && -w "$app_dir" ]] || { echo 'Prepare writable .env and .env.app files in DEPLOY_APP_DIR first.' >&2; exit 1; }
docker info >/dev/null
exec 8>"$app_dir/.runner-deploy.lock"
flock -n 8 || { echo 'Another runner deployment is in progress.' >&2; exit 1; }
docker_config=$(mktemp -d)
trap 'rm -rf -- "$docker_config"' EXIT
export DOCKER_CONFIG="$docker_config"
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io --username "$GHCR_USER" --password-stdin
unset GHCR_TOKEN
# Ship only deployment configuration. Runtime secrets and image history stay outside checkout.
install -m 644 "$repo_dir/deploy/compose.yml" "$app_dir/compose.yml"
install -m 644 "$repo_dir/deploy/Caddyfile" "$app_dir/Caddyfile"
install -m 755 "$repo_dir/deploy/deploy.sh" "$app_dir/deploy.sh"
bash "$app_dir/deploy.sh" "$IMAGE_REF"
