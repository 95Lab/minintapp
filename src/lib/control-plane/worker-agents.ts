import "server-only";
import { pool } from "../../../platform/store";

/** Agent URLs of workers with a fresh heartbeat and the current image, limited to the configured allowlist. */
export async function readyWorkerAgents() {
  const workers = await pool.query<{ agent_url: string }>("SELECT agent_url FROM workers WHERE heartbeat_at>now()-interval '30 seconds' AND $1=ANY(available_images)", [process.env.RUNTIME_IMAGE]);
  const allowed = (process.env.WORKER_AGENT_URLS || "").split(",");
  return workers.rows.map((worker) => worker.agent_url).filter((url) => allowed.includes(url));
}
