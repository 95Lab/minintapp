import { createHash } from "node:crypto";
import { pool } from "./store";
import { AppError } from "../src/lib/api/app-error-codes";
import { RuntimeSeedSchema, type Deployment, type RuntimeSeed } from "./contracts";
import type { DeploymentAction, DeploymentManagement } from "../src/lib/api/deployment-management-contract";
export type Release = { app_id: string; version: number; image: string; seed: RuntimeSeed; spec_digest: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED"; switch_started: boolean; previous_version: number | null; rollback_of: number | null; created_at: Date; completed_at: Date | null };
export const specDigest = (seed: RuntimeSeed) => createHash("sha256").update(JSON.stringify(seed.spec)).digest("hex");
export async function release(id: string, version: number) {
  return (await pool.query<Release>("SELECT * FROM app_releases WHERE app_id=$1 AND version=$2", [id, version])).rows[0] ?? null;
}
export async function ensureInitialRelease(app: Deployment) {
  const seed = RuntimeSeedSchema.parse(app.seed);
  await pool.query(`INSERT INTO app_releases(app_id,version,image,spec_digest,seed) VALUES($1,1,$2,$3,$4) ON CONFLICT DO NOTHING`, [app.id, app.image, specDigest(seed), seed]);
  return (await release(app.id, 1))!;
}
export async function releaseHistory(id: string): Promise<DeploymentManagement["versions"]> {
  const rows = (await pool.query<Release>("SELECT * FROM app_releases WHERE app_id=$1 ORDER BY version DESC LIMIT 100", [id])).rows;
  return rows.map(row => ({ version: row.version, image: row.image, specDigest: row.spec_digest, status: row.status,
    previousVersion: row.previous_version, rollbackOf: row.rollback_of, createdAt: row.created_at.toISOString(), completedAt: row.completed_at?.toISOString() ?? null }));
}
export async function approvedImages(workerId: string | null) {
  if (!workerId) return [];
  const row = (await pool.query<{ available_images: string[] }>("SELECT available_images FROM workers WHERE id=$1 AND heartbeat_at>now()-interval '30 seconds'", [workerId])).rows[0];
  return row?.available_images ?? [];
}
/** Serialize owner actions and reject stale browser submissions before reserving a new release. */
export async function manageDeployment(id: string, action: DeploymentAction) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const app = (await client.query<Deployment>("SELECT * FROM deployments WHERE id=$1 FOR UPDATE", [id])).rows[0];
    if (!app) throw new AppError("not_found");
    if (app.expires_at.getTime() <= Date.now() || ["EXPIRED", "DELETED"].includes(app.state)) throw new AppError("app_gone");
    if (!["RUNNING", "SUSPENDED", "FAILED"].includes(app.state) || app.requested_version) throw new AppError("deployment_pending");
    if (action.action === "deploy" || action.action === "rollback") {
      if (app.state !== "RUNNING" || !app.active_version || app.active_version !== action.expectedVersion) throw new AppError("invalid_request");
      const active = (await client.query<Release>("SELECT * FROM app_releases WHERE app_id=$1 AND version=$2", [id, app.active_version])).rows[0];
      const target = action.action === "rollback" ? (await client.query<Release>("SELECT * FROM app_releases WHERE app_id=$1 AND version=$2 AND status='SUCCEEDED'", [id, action.version])).rows[0] : active;
      if (!active || !target || target.spec_digest !== active.spec_digest) throw new AppError("invalid_request");
      const image = action.action === "deploy" ? action.image : target.image;
      if (image === active.image) throw new AppError("invalid_request");
      const worker = (await client.query<{ available_images: string[] }>("SELECT available_images FROM workers WHERE id=$1 AND heartbeat_at>now()-interval '30 seconds' FOR SHARE", [app.worker_id])).rows[0];
      if (!worker?.available_images.includes(image) || !worker.available_images.includes(active.image)) throw new AppError("runtime_unavailable");
      const version = (await client.query<{ next: number }>("SELECT COALESCE(max(version),0)+1 AS next FROM app_releases WHERE app_id=$1", [id])).rows[0].next;
      await client.query(`INSERT INTO app_releases(app_id,version,image,spec_digest,seed,previous_version,rollback_of) VALUES($1,$2,$3,$4,$5,$6,$7)`, [id, version, image, active.spec_digest, active.seed, active.version, action.action === "rollback" ? target.version : null]);
      await client.query("UPDATE deployments SET requested_version=$2,state='QUEUED',queued_at=NULL,revision=revision+1,updated_at=now() WHERE id=$1", [id, version]);
    } else if (action.action === "suspend") {
      if (app.state !== "RUNNING") throw new AppError("invalid_request");
      await client.query("UPDATE deployments SET state='SUSPENDED',updated_at=now() WHERE id=$1", [id]);
    } else if (action.action === "resume") {
      if (app.state !== "SUSPENDED") throw new AppError("invalid_request");
      await client.query("UPDATE deployments SET state='QUEUED',queued_at=NULL,revision=revision+1,updated_at=now() WHERE id=$1", [id]);
    } else {
      await client.query("UPDATE deployments SET expires_at=now()-interval '25 hours',updated_at=now() WHERE id=$1", [id]);
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
export async function completeRelease(app: Deployment, target: Release, failedVersion?: number) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(`UPDATE deployments SET active_version=$2,requested_version=NULL,image=$3,seed=$4,state='RUNNING',updated_at=now()
      WHERE id=$1 AND revision=$5 AND expires_at>now() AND state='DEPLOYING' RETURNING id`, [app.id, target.version, target.image, target.seed, app.revision]);
    if (!updated.rowCount) throw new Error("Release no longer current");
    await client.query("UPDATE app_releases SET status='SUCCEEDED',completed_at=COALESCE(completed_at,now()) WHERE app_id=$1 AND version=$2", [app.id, target.version]);
    if (failedVersion) await client.query("UPDATE app_releases SET status='FAILED',completed_at=now() WHERE app_id=$1 AND version=$2 AND status='PENDING'", [app.id, failedVersion]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
export async function failRelease(id: string, version: number) {
  await pool.query("UPDATE app_releases SET status='FAILED',completed_at=now() WHERE app_id=$1 AND version=$2 AND status='PENDING'", [id, version]);
  await pool.query("UPDATE deployments SET requested_version=NULL WHERE id=$1 AND requested_version=$2", [id, version]);
}

export async function beginReleaseSwitch(id: string, version: number) {
  await pool.query("UPDATE app_releases SET switch_started=true WHERE app_id=$1 AND version=$2 AND status='PENDING'", [id, version]);
}
