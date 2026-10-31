import { readdir } from "node:fs/promises";
import { pool } from "./store";
import { publishRoute, unpublishRoute } from "./gateway";
export async function syncGateway(localWorkerId: string) {
  const result = await pool.query<{ id: string; hostname: string; port: number; worker_id: string; gateway_url: string | null }>(`
    SELECT d.id,d.hostname,d.port,d.worker_id,w.gateway_url FROM deployments d JOIN workers w ON w.id=d.worker_id
    WHERE d.state IN ('DEPLOYING','RUNNING') AND d.port IS NOT NULL AND d.expires_at>now() AND w.heartbeat_at>now()-interval '30 seconds'`);
  const active = new Set<string>();
  const allowed = (process.env.WORKER_GATEWAY_URLS || "").split(",");
  for (const app of result.rows) {
    if (app.worker_id === localWorkerId) {
      await publishRoute(app.id, app.hostname, app.port);
    } else {
      if (!app.gateway_url || !allowed.includes(app.gateway_url)) continue;
      const target = new URL(app.gateway_url);
      if (!["http:", "https:"].includes(target.protocol) || target.origin !== app.gateway_url || target.username) continue;
      await publishRoute(app.id, app.hostname, app.port, target.origin);
    }
    active.add(app.id);
  }
  const files = await readdir(process.env.TRAEFIK_ROUTES_DIR || "/opt/minintapp/routes").catch(() => []);
  for (const file of files) if (/^[a-f0-9]{24}\.yml$/.test(file) && !active.has(file.slice(0, -4))) await unpublishRoute(file.slice(0, -4));
}
