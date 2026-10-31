#!/usr/bin/env bash
# Root-owned forced-command entrypoint. No shell, upload, or arbitrary Docker access.
set -euo pipefail
umask 077
[[ $# == 1 && "$1" =~ ^deploy\ ghcr\.io/95lab/minintapp@sha256:[a-f0-9]{64}$ ]] || exit 64
image=${1#deploy }
IFS= read -r registry_user
IFS= read -r registry_token
[[ "$registry_user" =~ ^[a-zA-Z0-9_-]+$ && -n "$registry_token" ]] || exit 64
export DOCKER_CONFIG
DOCKER_CONFIG=$(mktemp -d)
trap 'rm -rf -- "$DOCKER_CONFIG"' EXIT
printf '%s' "$registry_token" | docker login ghcr.io -u "$registry_user" --password-stdin
unset registry_token
bash /opt/minintapp/deploy.sh "$image"
