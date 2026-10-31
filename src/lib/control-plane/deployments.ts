import "server-only";
import { randomBytes, createHash, createHmac } from "node:crypto";
import { AppError } from "@/lib/api/app-error-codes";
import { newToken, hashToken } from "@/lib/security/token-hashing";
import { LIFETIME_MS, type GenerateRequest } from "@/lib/api/api-contract-types";
import { ImageDigest, type Deployment } from "../../../platform/contracts";
import { pool, deployment } from "../../../platform/store";
import { secureHostCookie } from "@/lib/host/host-session";

export async function submitDeployment(input: Deployment["input"], ownerId: string, options?: { requestKey: string; ownerSecret: string }) {
  const id = randomBytes(12).toString("hex");
  const tokenFor = (appId: string) => options ? createHmac("sha256", options.ownerSecret).update(appId).digest("base64url") : newToken();
  const hostToken = tokenFor(id);
  const lifetimeMs = input.lifetimeMs ?? LIFETIME_MS[input.lifetime];
  if (!Number.isSafeInteger(lifetimeMs) || lifetimeMs <= 0 || lifetimeMs > 7 * 86400000) throw new AppError("invalid_request");
  const image = ImageDigest.parse(process.env.RUNTIME_IMAGE);
  const domain = process.env.APPS_DOMAIN;
  if (!domain || !/^[a-z0-9.-]+$/.test(domain)) throw new Error("Missing apps domain");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(704130)");
    if (options) {
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(options.requestKey)) throw new AppError("invalid_request");
      const existing = (await client.query<Deployment>("SELECT * FROM deployments WHERE owner_id=$1 AND request_key=$2", [ownerId, options.requestKey])).rows[0];
      if (existing) {
        const equal = await client.query<{ same: boolean }>("SELECT input=$2::jsonb AS same FROM deployments WHERE id=$1", [existing.id, input]);
        if (!equal.rows[0].same) throw new AppError("invalid_request");
        await client.query("COMMIT");
        return { id: existing.id, hostToken: tokenFor(existing.id) };
      }
    }
    const recent = await client.query<{ count: string }>("SELECT count(*) FROM deployments WHERE created_at>now()-interval '1 hour'");
    if (Number(recent.rows[0].count) >= Number(process.env.MAX_CREATIONS_PER_HOUR || 30)) throw new AppError("rate_limited");
    const count = await client.query<{ count: string }>("SELECT count(*) FROM deployments WHERE state NOT IN ('EXPIRED','DELETED')");
    if (Number(count.rows[0].count) >= Number(process.env.MAX_ACTIVE_APPS || 3)) throw new AppError("rate_limited");
    const owned = await client.query<{ count: string }>("SELECT count(*) FROM deployments WHERE owner_id=$1 AND state NOT IN ('EXPIRED','DELETED')", [ownerId]);
    if (Number(owned.rows[0].count) >= 2) throw new AppError("rate_limited");
    await client.query(`INSERT INTO deployments(id,owner_id,state,input,host_token_hash,hostname,image,expires_at,request_key)
      VALUES($1,$2,'QUEUED',$3,$4,$5,$6,$7,$8)`, [id, ownerId, input, hashToken(hostToken), `${id}.${domain}`, image, new Date(Date.now() + lifetimeMs), options?.requestKey ?? null]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
  return { id, hostToken };
}
export function tenantIdentity(request: Request) {
  const cookieName = secureHostCookie(request) ? "__Host-minint_tenant" : "minint_tenant";
  const token = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  const secret = token && /^[a-f0-9]{64}$/.test(token) ? token : randomBytes(32).toString("hex");
  return { id: createHash("sha256").update(secret).digest("hex"), token: secret, cookieName };
}
export async function createManagedApp(request: Request, input: GenerateRequest | Deployment["input"]) {
  const tenant = tenantIdentity(request);
  const requestKey = request.headers.get("idempotency-key") || randomBytes(16).toString("hex");
  const result = await submitDeployment(input, "ownerId" in input && input.ownerId ? input.ownerId : tenant.id, { requestKey, ownerSecret: tenant.token });
  const deployed = (await deployment(result.id))!;
  return { ...result, deployed, tenant };
}
