import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import type { Deployment } from "./contracts";

const state = globalThis as typeof globalThis & { minintControlPool?: Pool };
export const pool = state.minintControlPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 8, connectionTimeoutMillis: 5000 });
export async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(704128)");
    await client.query(await readFile(new URL("./schema.sql", import.meta.url), "utf8"));
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
export async function deployment(id: string): Promise<Deployment | null> {
  const result = await pool.query<Deployment>("SELECT * FROM deployments WHERE id=$1", [id]);
  return result.rows[0] ?? null;
}
export async function updateState(id: string, state: Deployment["state"]) {
  if (state === "DELETED") {
    await pool.query("UPDATE deployments SET state='DELETED',seed=NULL,input=$2,generation=NULL,host_token_hash=repeat('0',64),updated_at=now() WHERE id=$1", [id, { prompt: "", lifetime: "1h" }]);
    return;
  }
  await pool.query("UPDATE deployments SET state=$2,updated_at=now() WHERE id=$1", [id, state]);
}
// Capacity is reserved atomically across schedulers; all schedulers use the same transaction lock.
export async function reserveWorker(id: string): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(704129)");
    const current = (await client.query<Deployment>("SELECT * FROM deployments WHERE id=$1 FOR UPDATE", [id])).rows[0];
    if (!current) throw new Error("Unknown deployment");
    if (current.worker_id) { await client.query("COMMIT"); return current.worker_id; }
    const result = await client.query<{ id: string }>(`
      SELECT w.id FROM workers w
      WHERE heartbeat_at > now() - interval '30 seconds'
        AND $1 = ANY(w.available_images)
        AND (SELECT count(*) FROM deployments d WHERE d.worker_id=w.id AND d.state IN ('QUEUED','GENERATING','BUILDING','DEPLOYING','RUNNING','SUSPENDED')) < capacity
      ORDER BY (SELECT count(*) FROM deployments d WHERE d.worker_id=w.id AND d.state NOT IN ('EXPIRED','DELETED','FAILED')) ASC, w.id
      LIMIT 1`, [current.image]);
    if (!result.rows[0]) throw new Error("No worker capacity");
    const worker = result.rows[0].id;
    await client.query("UPDATE deployments SET worker_id=$2 WHERE id=$1", [id, worker]);
    await client.query("COMMIT");
    return worker;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
