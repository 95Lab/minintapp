import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import { RuntimeSeedSchema, type Deployment } from "./contracts";
import { createHash } from "node:crypto";

const state = globalThis as typeof globalThis & { minintControlPool?: Pool };
function createControlPool() {
  const created = new Pool({ connectionString: process.env.DATABASE_URL, max: 8, connectionTimeoutMillis: 5000 });
  // pg emits this when an idle client drops; left unhandled, a Postgres restart kills the whole process.
  created.on("error", () => console.error("Control database connection lost"));
  return created;
}
export const pool = state.minintControlPool ??= createControlPool();
export async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(704128)");
    await client.query(await readFile(new URL("./schema.sql", import.meta.url), "utf8"));
    const existing = await client.query<Deployment>("SELECT * FROM deployments WHERE seed IS NOT NULL AND active_version IS NULL AND state IN ('RUNNING','SUSPENDED')");
    for (const app of existing.rows) {
      const seed = RuntimeSeedSchema.parse(app.seed);
      const digest = createHash("sha256").update(JSON.stringify(seed.spec)).digest("hex");
      await client.query(`INSERT INTO app_releases(app_id,version,image,spec_digest,seed,status,completed_at)
        VALUES($1,1,$2,$3,$4,'SUCCEEDED',now()) ON CONFLICT DO NOTHING`, [app.id, app.image, digest, seed]);
      await client.query("UPDATE deployments SET active_version=1 WHERE id=$1", [app.id]);
    }
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
    await pool.query("UPDATE deployments SET state='DELETED',active_version=NULL,requested_version=NULL,seed=NULL,input=$2,generation=NULL,host_token_hash=repeat('0',64),updated_at=now() WHERE id=$1", [id, { prompt: "", lifetime: "1h" }]);
    return;
  }
  if (state === "EXPIRED") {
    await pool.query(`WITH failed AS (UPDATE app_releases SET status='FAILED',completed_at=now() WHERE app_id=$1 AND status='PENDING' RETURNING version)
      UPDATE deployments SET state='EXPIRED',requested_version=NULL,updated_at=now() WHERE id=$1`, [id]);
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

// Public dashboard projection: never return seed, input or host credentials.
export async function ownedDeploymentSummaries(ownerIds: string[]) {
  const result = await pool.query(`SELECT id,state,hostname,created_at,expires_at,
    COALESCE(seed->'spec'->>'title',input->'spec'->>'title') AS title
    FROM deployments WHERE owner_id=ANY($1::text[]) ORDER BY created_at DESC LIMIT 100`, [ownerIds]);
  return result.rows;
}
export async function countOwnedDeployments(ownerId: string): Promise<number> {
  const result = await pool.query<{ count: string }>("SELECT count(*) FROM deployments WHERE owner_id=$1 AND state NOT IN ('EXPIRED','DELETED','FAILED')", [ownerId]);
  return Number(result.rows[0].count);
}
