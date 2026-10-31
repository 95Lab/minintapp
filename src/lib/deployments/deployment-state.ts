import { randomBytes } from "node:crypto";
import { CreateDeploymentSchema, DeploymentCommandSchema, DeploymentRecordSchema, type CreateDeployment, type DeploymentCommand, type DeploymentRecord } from "./deployment-schema";

export class DeploymentConflict extends Error {
  constructor(readonly code: "not_found" | "version_conflict" | "invalid_transition" | "expired" | "attempts_exhausted" | "idempotency_conflict" | "hostname_conflict") { super(code); }
}
const id = () => randomBytes(12).toString("hex");
export function createDeployment(input: CreateDeployment, now: number): DeploymentRecord {
  const intent = CreateDeploymentSchema.parse(input);
  if (intent.expiresAt <= now) throw new DeploymentConflict("expired");
  return DeploymentRecordSchema.parse({
    ...intent, id: id(), version: 1, state: "QUEUED", imageRef: null,
    workerId: null, sandboxId: null, volumeId: null, dnsRecordId: null,
    gatewayVerifiedAt: null, deletedAt: null, createdAt: now, updatedAt: now,
    job: { id: id(), status: "QUEUED", attempt: 0, maxAttempts: intent.maxAttempts, startedAt: null, finishedAt: null },
    lastError: null, errors: [],
  });
}
export function sameDeploymentIntent(a: DeploymentRecord, b: DeploymentRecord): boolean {
  return JSON.stringify(CreateDeploymentSchema.parse(aIntent(a))) === JSON.stringify(CreateDeploymentSchema.parse(aIntent(b)));
}
function aIntent(r: DeploymentRecord) {
  return { appId: r.appId, idempotencyKey: r.idempotencyKey, hostname: r.hostname, specHash: r.specHash, templateVersion: r.templateVersion, expiresAt: r.expiresAt, maxAttempts: r.maxAttempts };
}
const activeStages = ["GENERATING", "BUILDING", "DEPLOYING"];
/** Trusted worker metadata only. No Docker/DNS/health side effects are performed here. */
export function applyDeploymentCommand(current: DeploymentRecord, raw: DeploymentCommand, now: number): DeploymentRecord {
  const r = structuredClone(DeploymentRecordSchema.parse(current));
  const command = DeploymentCommandSchema.parse(raw);
  const requireState = (...states: DeploymentRecord["state"][]) => {
    if (!states.includes(r.state)) throw new DeploymentConflict("invalid_transition");
  };
  if (now < r.updatedAt) throw new DeploymentConflict("invalid_transition");
  if (!["expire", "delete"].includes(command.type) && r.expiresAt <= now) throw new DeploymentConflict("expired");
  const verifyGateway = (url: string) => {
    if (url !== `https://${r.hostname}/`) throw new DeploymentConflict("invalid_transition");
    r.gatewayVerifiedAt = now;
  };
  switch (command.type) {
    case "start":
      requireState("QUEUED");
      if (r.job.attempt >= r.maxAttempts) throw new DeploymentConflict("attempts_exhausted");
      // Retries keep their reserved resources; never move an existing sandbox to another worker implicitly.
      if (r.sandboxId && r.workerId !== command.workerId) throw new DeploymentConflict("invalid_transition");
      r.workerId = command.workerId; r.state = "GENERATING";
      r.job.status = "RUNNING"; r.job.attempt++; r.job.startedAt = now; r.job.finishedAt = null;
      break;
    case "build": requireState("GENERATING"); r.state = "BUILDING"; break;
    case "deploy":
      requireState("BUILDING");
      if (r.sandboxId && r.imageRef !== command.imageRef) throw new DeploymentConflict("invalid_transition");
      r.imageRef = command.imageRef; r.state = "DEPLOYING"; break;
    case "resources":
      requireState("DEPLOYING");
      for (const key of ["sandboxId", "volumeId", "dnsRecordId"] as const) {
        if (command[key] === undefined) continue;
        if (r[key] !== null && r[key] !== command[key]) throw new DeploymentConflict("invalid_transition");
        r[key] = command[key];
      }
      break;
    case "ready":
      requireState("DEPLOYING"); verifyGateway(command.verifiedUrl);
      r.state = "RUNNING"; r.job.status = "SUCCEEDED"; r.job.finishedAt = now; break;
    case "fail": {
      requireState("GENERATING", "BUILDING", "DEPLOYING");
      const allowed = command.code === "job_timeout" || (r.state === "GENERATING" ? command.code === "generation_failed" : r.state === "BUILDING" ? ["build_failed", "image_publish_failed"].includes(command.code) : ["capacity_unavailable", "sandbox_failed", "dns_failed", "gateway_failed"].includes(command.code));
      if (!allowed) throw new DeploymentConflict("invalid_transition");
      const error = { code: command.code, retryable: command.retryable, stage: r.state as "GENERATING" | "BUILDING" | "DEPLOYING", attempt: r.job.attempt, occurredAt: now };
      r.lastError = error; r.errors.push(error); r.state = "FAILED"; r.job.status = "FAILED"; r.job.finishedAt = now; break;
    }
    case "retry":
      requireState("FAILED");
      if (!r.lastError?.retryable) throw new DeploymentConflict("invalid_transition");
      if (r.job.attempt >= r.maxAttempts) throw new DeploymentConflict("attempts_exhausted");
      r.state = "QUEUED"; r.job.status = "QUEUED"; r.job.startedAt = null; r.job.finishedAt = null;
      r.lastError = null; r.gatewayVerifiedAt = null; break;
    case "suspend": requireState("RUNNING"); r.state = "SUSPENDED"; r.gatewayVerifiedAt = null; break;
    case "resume": requireState("SUSPENDED"); verifyGateway(command.verifiedUrl); r.state = "RUNNING"; break;
    case "expire":
      if (r.state === "DELETED" || r.state === "EXPIRED" || r.expiresAt > now) throw new DeploymentConflict("invalid_transition");
      if (r.state === "QUEUED" || activeStages.includes(r.state)) { r.job.status = "CANCELLED"; r.job.finishedAt = now; }
      r.state = "EXPIRED"; r.gatewayVerifiedAt = null; break;
    case "delete":
      requireState("FAILED", "SUSPENDED", "EXPIRED");
      r.state = "DELETED"; r.deletedAt = now; r.gatewayVerifiedAt = null; break;
  }
  r.version++; r.updatedAt = now;
  return DeploymentRecordSchema.parse(r);
}
