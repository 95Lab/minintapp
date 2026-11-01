import { z } from "zod";
import { AppSpecSchema as EngineSpecSchema } from "../src/engine/app-spec/app-spec-schema";
import { AppSpecSchema } from "../src/lib/app-spec/app-spec-schema";

export const AppId = z.string().regex(/^[a-f0-9]{24}$/);
export const ImageDigest = z.string().regex(/^ghcr\.io\/95lab\/minintapp@sha256:[a-f0-9]{64}$/);
export const DeploymentState = z.enum(["QUEUED", "GENERATING", "BUILDING", "DEPLOYING", "RUNNING", "FAILED", "SUSPENDED", "EXPIRED", "DELETED"]);
export const MyAppsResponseSchema = z.object({ apps: z.array(z.object({ id: AppId, state: DeploymentState, hostname: z.string(), title: z.string().nullable().optional(), created_at: z.string(), expires_at: z.string() })) });
export const RuntimeSeedSchema = z.object({
  id: AppId, spec: z.union([AppSpecSchema, EngineSpecSchema]), prompt: z.string().max(4000),
  hostTokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  parentId: AppId.nullable().optional(), createdAt: z.number().int(), expiresAt: z.number().int(), ownerId: z.string().nullable(),
});
export type RuntimeSeed = z.infer<typeof RuntimeSeedSchema>;
export type Deployment = {
  id: string; owner_id: string; state: z.infer<typeof DeploymentState>; seed: RuntimeSeed | null;
  input: { subdomain?:string; spec?: RuntimeSeed["spec"]; prompt: string; lifetime: "1h" | "24h" | "7d"; lifetimeMs?: number; engine?: boolean; ownerId?: string; parentId?: string;
    remix?: { spec: RuntimeSeed["spec"]; instruction: string; summary: string } };
  host_token_hash: string; hostname: string; image: string; worker_id: string | null;
  port: number | null; dns_record_id: string | null; created_at: Date; expires_at: Date;
  generation: import("../src/lib/generation/llm-output-types").GenerationMeta | import("../src/engine/generation/llm-output-types").GenerationMeta | null;
  revision: number; active_version: number | null; requested_version: number | null;
};
export function redisConnection(value: string) {
  const url = new URL(value);
  if (!["redis:", "rediss:"].includes(url.protocol)) throw new Error("Invalid Redis URL");
  return { host: url.hostname, port: Number(url.port || 6379), username: decodeURIComponent(url.username) || undefined,
    password: decodeURIComponent(url.password) || undefined, db: Number(url.pathname.slice(1) || 0),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}), maxRetriesPerRequest: null };
}
