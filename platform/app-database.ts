import { createHmac } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { AppId, RuntimeSeedSchema, type RuntimeSeed } from "./contracts";
import { pool } from "./store";
import { initialRuntime } from "../src/lib/blocks/block-definition-types";
import type { AppSnapshot } from "../src/lib/db/apps-repository-types";

const identifier = (id: string) => `app_${AppId.parse(id)}`;
const marker = (id: string) => `minintapp:${AppId.parse(id)}`;
const password = (id: string) => createHmac("sha256", process.env.WORKER_TOKEN!).update(`postgres:${AppId.parse(id)}`).digest("hex");
export function appDatabaseURL(id: string, runtime = false) {
  const url = new URL(process.env.DATABASE_URL!);
  if (runtime) {
    const endpoint = new URL(process.env.RUNTIME_POSTGRES_URL!);
    url.hostname = endpoint.hostname; url.port = endpoint.port;
  }
  url.username = identifier(id); url.password = password(id); url.pathname = `/${identifier(id)}`;
  return url.toString();
}
function adminDatabaseURL(id: string) {
  const url = new URL(process.env.DATABASE_URL!); url.pathname = `/${identifier(id)}`; return url.toString();
}
async function ownership(client: PoolClient, id: string) {
  const name = identifier(id);
  const db = (await client.query("SELECT shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1", [name])).rows[0];
  const role = (await client.query("SELECT shobj_description(oid,'pg_authid') AS marker FROM pg_roles WHERE rolname=$1", [name])).rows[0];
  if ((db && db.marker !== marker(id)) || (role && role.marker !== marker(id))) throw new Error("App database ownership mismatch");
  return { db, role };
}
/** Run only on the dedicated MinintApp cluster; never touch an unrelated cluster. */
export async function secureAppDatabaseCluster() {
  const current = (await pool.query("SELECT current_database() AS name, current_user AS owner")).rows[0];
  const databases = await pool.query("SELECT datname, pg_get_userbyid(datdba) AS owner FROM pg_database WHERE NOT datistemplate");
  if (databases.rows.some((row) => row.owner !== current.owner || (row.datname !== current.name && row.datname !== "postgres" && !/^app_[a-f0-9]{24}$/.test(row.datname)))) throw new Error("Unexpected database on dedicated cluster");
  // Prevent app logins from reaching metadata, default databases, or other apps.
  for (const name of [current.name, "postgres", "template0", "template1"]) {
    if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error("Invalid administrative database name");
    await pool.query(`REVOKE ALL ON DATABASE "${name}" FROM PUBLIC`);
  }
}
export async function ensureAppDatabase(bootstrap: RuntimeSeed) {
  const seed = RuntimeSeedSchema.parse(bootstrap), id = seed.id, name = identifier(id);
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtextextended($1,704134))", [name]);
    const existing = await ownership(client, id);
    if (!existing.role) {
      await client.query("BEGIN");
      try {
        await client.query(`CREATE ROLE "${name}" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5`);
        await client.query(`COMMENT ON ROLE "${name}" IS '${marker(id)}'`);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; }
    }
    if (!existing.db) {
      await client.query(`CREATE DATABASE "${name}" TEMPLATE template0 ALLOW_CONNECTIONS false`);
      await client.query(`COMMENT ON DATABASE "${name}" IS '${marker(id)}'`);
    }
    await client.query(`REVOKE ALL ON DATABASE "${name}" FROM PUBLIC`);
    await client.query(`GRANT CONNECT ON DATABASE "${name}" TO "${name}"`);
    await client.query(`ALTER DATABASE "${name}" ALLOW_CONNECTIONS true`);
    const admin = new Pool({ connectionString: adminDatabaseURL(id), max: 1, connectionTimeoutMillis: 5000 });
    try {
      await admin.query(`REVOKE ALL ON SCHEMA public FROM PUBLIC;
        CREATE TABLE IF NOT EXISTS public.app_snapshot (
          id text PRIMARY KEY CHECK (id='${id}'),
          document jsonb NOT NULL CHECK ((document->'app'->>'id') IS NOT DISTINCT FROM '${id}') CHECK (octet_length(document::text)<=16777216)
        );
        GRANT USAGE ON SCHEMA public TO "${name}";
        GRANT SELECT, UPDATE ON public.app_snapshot TO "${name}";`);
      const snapshot = { app: { ...seed, parentId: seed.parentId ?? null, status: "active", runtime: initialRuntime(), stateVersion: 1, movedTo: null, endedAt: null, announcement: null }, responses: [] };
      await admin.query("INSERT INTO public.app_snapshot(id,document) VALUES($1,$2) ON CONFLICT(id) DO NOTHING", [id, snapshot]);
    } finally { await admin.end(); }
    // Password is a per-app derived capability. Never log raw SQL/provider errors.
    await client.query(`ALTER ROLE "${name}" WITH LOGIN PASSWORD '${password(id)}'`);
    await client.query(`ALTER ROLE "${name}" SET statement_timeout='5s'`);
    await client.query(`ALTER ROLE "${name}" SET idle_in_transaction_session_timeout='10s'`);
    await client.query(`ALTER ROLE "${name}" SET search_path=public,pg_catalog`);
  } catch { throw new Error("App database provisioning failed"); }
  finally { await client.query("SELECT pg_advisory_unlock(hashtextextended($1,704134))", [name]).catch(() => {}); client.release(); }
}
export async function readAppDatabase(id: string): Promise<AppSnapshot | null> {
  const db = new Pool({ connectionString: appDatabaseURL(id), max: 1, connectionTimeoutMillis: 5000 });
  try { return (await db.query("SELECT document FROM app_snapshot WHERE id=$1", [AppId.parse(id)])).rows[0]?.document ?? null; }
  finally { await db.end(); }
}
export async function dropAppDatabase(id: string) {
  const name = identifier(id), client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtextextended($1,704134))", [name]);
    const owned = await ownership(client, id);
    if (owned.db) await client.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    if (owned.role) await client.query(`DROP ROLE "${name}"`);
  } finally { await client.query("SELECT pg_advisory_unlock(hashtextextended($1,704134))", [name]).catch(() => {}); client.release(); }
}
