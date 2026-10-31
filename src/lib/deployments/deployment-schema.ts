import { z } from "zod";

const Id = z.string().regex(/^[a-f0-9]{24}$/);
const Timestamp = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const ResourceId = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/);
export const DeploymentStateSchema = z.enum(["QUEUED", "GENERATING", "BUILDING", "DEPLOYING", "RUNNING", "FAILED", "SUSPENDED", "EXPIRED", "DELETED"]);
export const JobStatusSchema = z.enum(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"]);
export const DeploymentErrorCodeSchema = z.enum(["generation_failed", "build_failed", "image_publish_failed", "capacity_unavailable", "sandbox_failed", "dns_failed", "gateway_failed", "job_timeout"]);
export const HostnameSchema = z.string().max(253).regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/);
// Mutable image tags are never a deployable artifact. Credentials/URLs/CLI options are disallowed.
export const ImageRefSchema = z.string().max(512).regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*(?::[0-9]{1,5})?(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)+@sha256:[a-f0-9]{64}$/);
export const CreateDeploymentSchema = z.strictObject({
  appId: Id,
  idempotencyKey: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/),
  hostname: HostnameSchema,
  specHash: z.string().regex(/^[a-f0-9]{64}$/),
  templateVersion: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/),
  expiresAt: Timestamp,
  maxAttempts: z.number().int().min(1).max(10).default(3),
});
export const DeploymentErrorSchema = z.strictObject({
  code: DeploymentErrorCodeSchema,
  stage: z.enum(["GENERATING", "BUILDING", "DEPLOYING"]),
  retryable: z.boolean(),
  attempt: z.number().int().min(1).max(10),
  occurredAt: Timestamp,
});
export const DeploymentJobSchema = z.strictObject({
  id: Id,
  status: JobStatusSchema,
  attempt: z.number().int().min(0).max(10),
  maxAttempts: z.number().int().min(1).max(10),
  startedAt: Timestamp.nullable(),
  finishedAt: Timestamp.nullable(),
});
export const DeploymentRecordSchema = CreateDeploymentSchema.extend({
  id: Id,
  version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  state: DeploymentStateSchema,
  imageRef: ImageRefSchema.nullable(),
  workerId: ResourceId.nullable(),
  sandboxId: ResourceId.nullable(),
  volumeId: ResourceId.nullable(),
  dnsRecordId: ResourceId.nullable(),
  gatewayVerifiedAt: Timestamp.nullable(),
  deletedAt: Timestamp.nullable(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
  job: DeploymentJobSchema,
  lastError: DeploymentErrorSchema.nullable(),
  errors: z.array(DeploymentErrorSchema).max(10),
}).superRefine((r, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (r.updatedAt < r.createdAt || r.expiresAt <= r.createdAt) issue("Invalid deployment timestamps");
  for (const at of [r.job.startedAt, r.job.finishedAt, r.gatewayVerifiedAt, r.deletedAt]) {
    if (at !== null && (at < r.createdAt || at > r.updatedAt)) issue("Invalid event timestamp");
  }
  if (r.job.startedAt !== null && r.job.finishedAt !== null && r.job.finishedAt < r.job.startedAt) issue("Job finished before start");
  if (r.job.attempt > r.maxAttempts || r.job.maxAttempts !== r.maxAttempts) issue("Invalid attempt budget");
  if (r.state === "QUEUED" && r.job.status !== "QUEUED") issue("Queued deployment requires queued job");
  if (["GENERATING", "BUILDING", "DEPLOYING"].includes(r.state) && r.job.status !== "RUNNING") issue("Active stage requires running job");
  if (["RUNNING", "SUSPENDED"].includes(r.state) && r.job.status !== "SUCCEEDED") issue("Runtime requires successful job");
  if (r.state === "FAILED" && (r.job.status !== "FAILED" || !r.lastError)) issue("Failure requires error and failed job");
  if (["DEPLOYING", "RUNNING", "SUSPENDED"].includes(r.state) && !r.imageRef) issue("Immutable image required");
  if (["RUNNING", "SUSPENDED"].includes(r.state) && (!r.sandboxId || !r.volumeId || !r.workerId || !r.dnsRecordId)) issue("Verified runtime resources required");
  if (r.state === "RUNNING" && r.gatewayVerifiedAt === null) issue("Gateway verification required");
  if (["GENERATING", "BUILDING", "DEPLOYING"].includes(r.state) && (!r.workerId || r.job.attempt < 1 || r.job.startedAt === null)) issue("Claimed job required");
  if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(r.job.status) && r.job.finishedAt === null) issue("Finished job requires timestamp");
  if (["QUEUED", "RUNNING"].includes(r.job.status) && r.job.finishedAt !== null) issue("Unfinished job cannot have finish timestamp");
  if (r.state === "DELETED" && r.deletedAt === null) issue("Cleanup confirmation required");
  if (r.state !== "DELETED" && r.deletedAt !== null) issue("Only deleted deployments have deletion timestamp");
});

export const DeploymentCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("start"), workerId: ResourceId }),
  z.strictObject({ type: z.literal("build") }),
  z.strictObject({ type: z.literal("deploy"), imageRef: ImageRefSchema }),
  z.strictObject({ type: z.literal("resources"), sandboxId: ResourceId.optional(), volumeId: ResourceId.optional(), dnsRecordId: ResourceId.optional() }).refine(c => !!(c.sandboxId || c.volumeId || c.dnsRecordId), "At least one resource required"),
  z.strictObject({ type: z.literal("ready"), verifiedUrl: z.url() }),
  z.strictObject({ type: z.literal("fail"), code: DeploymentErrorCodeSchema, retryable: z.boolean() }),
  z.strictObject({ type: z.literal("retry") }),
  z.strictObject({ type: z.literal("suspend") }),
  z.strictObject({ type: z.literal("resume"), verifiedUrl: z.url() }),
  z.strictObject({ type: z.literal("expire") }),
  z.strictObject({ type: z.literal("delete"), cleanupConfirmed: z.literal(true) }),
]);
export type DeploymentRecord = z.infer<typeof DeploymentRecordSchema>;
export type CreateDeployment = z.input<typeof CreateDeploymentSchema>;
export type DeploymentCommand = z.infer<typeof DeploymentCommandSchema>;
export type DeploymentErrorCode = z.infer<typeof DeploymentErrorCodeSchema>;
