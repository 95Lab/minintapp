#!/usr/bin/env bash
# Root-owned deployment helper. Only install the Worker bundled in the approved repository image.
set -euo pipefail
umask 077
image=${1:?Immutable image required}
[[ "$image" =~ ^ghcr\.io/95lab/minintapp@sha256:([a-f0-9]{64})$ ]] || exit 64
revision=${BASH_REMATCH[1]}
root=/opt/minintapp
target="$root/worker-releases/$revision"
extract="minintapp-extract-$$"
install -d -m 750 "$target"
trap 'docker rm -f "$extract" >/dev/null 2>&1 || true' EXIT
docker create --name "$extract" --label io.minintapp.role=worker-extract "$image" >/dev/null
docker cp "$extract:/opt/minintapp-worker/worker.mjs" "$target/worker.mjs"
docker cp "$extract:/opt/minintapp-worker/schema.sql" "$target/schema.sql"
[[ -f "$target/worker.mjs" && ! -L "$target/worker.mjs" && -f "$target/schema.sql" && ! -L "$target/schema.sql" ]]
chmod 600 "$target/worker.mjs" "$target/schema.sql"
previous=$(readlink "$root/worker-current" || true)
if [[ -n "$previous" ]]; then printf '%s\n' "$previous" > "$root/.worker.previous"; fi
systemctl stop minintapp-worker
ln -sfnT "$target" "$root/worker-next"
mv -Tf "$root/worker-next" "$root/worker-current"
systemctl start minintapp-worker
if ! /usr/bin/node --env-file=/root/.config/ai-secrets/api.env --env-file=/opt/minintapp/.env.worker --input-type=module - <<'JS'

let ready=false;
for(let n=0;n<60;n++) {
  try {
    const r=await fetch(process.env.WORKER_AGENT_URL+'/health',{headers:{Authorization:'Bearer '+process.env.WORKER_TOKEN},signal:AbortSignal.timeout(2000)});
    if(r.ok && (await r.json()).workerId===process.env.WORKER_ID){ready=true;break;}
  } catch {}
  await new Promise(r=>setTimeout(r,1000));
}
if(!ready){console.error('Worker health check failed');process.exitCode=1;}
JS
then
  if [[ -n "$previous" ]]; then
    systemctl stop minintapp-worker
    ln -sfnT "$previous" "$root/worker-next"
    mv -Tf "$root/worker-next" "$root/worker-current"
    systemctl start minintapp-worker
  fi
  exit 1
fi
