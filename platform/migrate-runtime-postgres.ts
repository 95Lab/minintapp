// Explicit per-app migration. Stop the dedicated Worker first; old SQLite volumes are retained.
import { Pool } from "pg";
import { isDeepStrictEqual } from "node:util";
import { AppId, ImageDigest, RuntimeSeedSchema } from "./contracts";
import { pool, deployment } from "./store";
import { run, provision } from "./docker-runtime";
import { ensureAppDatabase, appDatabaseURL, readAppDatabase } from "./app-database";
import { putBackup } from "./artifacts";
import { runtimeHealth } from "./runtime-health";
import { publishRoute, unpublishRoute } from "./gateway";
import { RuntimeSnapshotSchema } from "../src/lib/runtime-plane/snapshot-schema";
const id = AppId.parse(process.argv[2]), image = ImageDigest.parse(process.argv[3]);
const resource = `minintapp-${id}`, rollback = `${resource}-sqlite-rollback`;
try {
  if (await run("systemctl", ["show", "minintapp-worker", "--property=ActiveState", "--value"]) !== "inactive") throw new Error("Stop the dedicated Worker before migration");
  const app = await deployment(id);
  if (!app || app.worker_id !== process.env.WORKER_ID || !["RUNNING", "SUSPENDED"].includes(app.state)) throw new Error("Migration ownership/state mismatch");
  await run("docker", ["image", "inspect", image]);
  const volume = JSON.parse(await run("docker", ["volume", "inspect", resource]))[0];
  if (volume.Labels?.["io.minintapp.app"] !== id) throw new Error("Volume ownership mismatch");
  let container: { Config: { Labels?: Record<string,string>; Env: string[] } } | undefined;
  try { container = JSON.parse(await run("docker", ["container", "inspect", resource]))[0]; } catch {}
  if (container && (container.Config.Labels?.["io.minintapp.app"] !== id || container.Config.Env.some(value => value.startsWith("DATABASE_URL=")))) throw new Error("Container is not an owned legacy SQLite runtime");
  await unpublishRoute(id);
  if (container) await run("docker", ["stop", resource]);
  let renamed = false, upgraded = false;
  try {
    const raw = await run("docker", ["run", "--rm", "--runtime=runsc", "--network=none", "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges:true", "--mount", `type=volume,src=${resource},dst=/data,readonly`, "--entrypoint=node", image, "--input-type=module", "-e", "import{DatabaseSync}from'node:sqlite';const db=new DatabaseSync('/data/app.sqlite',{readOnly:true});const row=db.prepare('SELECT snapshot FROM app_snapshot').get();if(!row)process.exit(1);process.stdout.write(row.snapshot);db.close();"], 20 * 1024 * 1024);
    const snapshot = RuntimeSnapshotSchema.parse(JSON.parse(raw));
    if (snapshot.app?.id !== id || snapshot.app.hostTokenHash !== app.host_token_hash || !Array.isArray(snapshot.responses)) throw new Error("Legacy snapshot identity mismatch");
    await putBackup(id, Buffer.from(JSON.stringify({ format: "minintapp-sqlite-export-v1", appId: id, snapshot })));
    await ensureAppDatabase(RuntimeSeedSchema.parse(app.seed));
    const db = new Pool({ connectionString: (() => { const url = new URL(process.env.DATABASE_URL!); url.pathname = new URL(appDatabaseURL(id)).pathname; return url.toString(); })(), max: 1 });
    try { await db.query("UPDATE app_snapshot SET document=$2 WHERE id=$1", [id, snapshot]); } finally { await db.end(); }
    if (!isDeepStrictEqual(await readAppDatabase(id), snapshot)) throw new Error("Snapshot verification failed");
    if (app.state === "RUNNING") {
      if (container) { await run("docker", ["rename", resource, rollback]); renamed = true; }
      upgraded = true; const port = await provision({ ...app, image });
      let healthy = false;
      for (let n=0;n<60;n++) { try { await runtimeHealth(`http://127.0.0.1:${port}/api/health`,id); healthy=true;break; } catch {} await new Promise(resolve=>setTimeout(resolve,1000)); }
      if (!healthy) throw new Error("New PostgreSQL runtime failed health check");
      await pool.query("UPDATE deployments SET image=$2,port=$3,updated_at=now() WHERE id=$1",[id,image,port]);
      await publishRoute(id,app.hostname,port);
    } else await pool.query("UPDATE deployments SET image=$2,updated_at=now() WHERE id=$1",[id,image]);
    if (renamed) await run("docker",["rm",rollback]);
    console.log(JSON.stringify({event:"runtime_migrated_to_postgres",id,responses:snapshot.responses.length,legacyVolumeRetained:true}));
  } catch {
    if (upgraded) await run("docker",["rm","-f",resource]).catch(()=>{});
    if (renamed) await run("docker",["rename",rollback,resource]);
    if (container && app.state === "RUNNING") { await run("docker",["start",resource]); if(app.port)await publishRoute(id,app.hostname,app.port); }
    throw new Error("Migration failed; legacy runtime restored where available");
  }
} catch { console.error("PostgreSQL migration failed; inspect owned runtime health and retry. No snapshot values were logged."); process.exitCode=1; }
finally { await pool.end(); }
