#!/usr/bin/env bash
set -euo pipefail
revision=${1:?Commit SHA required}
[[ "$revision" =~ ^[0-9a-f]{40}$ ]]
cd "/opt/minintapp/releases/$revision"
test -f Dockerfile
exec 9>/opt/minintapp/deploy.lock
flock -n 9 || { echo "Another deployment is running"; exit 1; }
python3 scripts/network-preflight.py
available=$(df -Pk /opt/minintapp | awk 'NR==2 {print $4}')
(( available >= 10485760 )) || { echo "At least 10 GiB free disk required"; exit 1; }

export MININTAPP_IMAGE="minintapp-web:$revision"
docker build --memory=2g --tag "$MININTAPP_IMAGE" .
if ! docker network inspect minintapp-platform >/dev/null 2>&1; then
  docker network create --driver bridge --subnet 172.30.240.0/24 \
    --label io.minintapp.owner=minintapp minintapp-platform
fi

state=/opt/minintapp/current-image
previous=""
if [[ -f "$state" ]]; then previous=$(cat "$state"); fi
# A first deployment must not take over an occupied host port.
if [[ -z "$previous" ]] && ss -H -lnt 'sport = :18080' | grep -q .; then
  echo "Port 18080 already occupied; refusing deployment"
  exit 1
fi
compose=(docker compose -p minintapp -f deploy/compose.yml)
if "${compose[@]}" up -d --wait --wait-timeout 120; then
  printf '%s\n' "$MININTAPP_IMAGE" > "$state.tmp"
  mv "$state.tmp" "$state"
else
  if [[ -n "$previous" ]]; then
    export MININTAPP_IMAGE="$previous"
    "${compose[@]}" up -d --wait --wait-timeout 120
  else
    "${compose[@]}" stop web
  fi
  exit 1
fi
