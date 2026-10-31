import { describe, expect, it } from "vitest";
import { MemoryDeploymentsRepository } from "@/lib/db/memory-deployments-repository";
import { DeploymentCommandSchema, DeploymentRecordSchema, HostnameSchema, ImageRefSchema, type DeploymentCommand } from "@/lib/deployments/deployment-schema";
import { deploymentImage, deploymentInput } from "../support/deployment-fixtures";

const setup = () => {
  let now = 1000;
  const repo = new MemoryDeploymentsRepository(() => now);
  return { repo, tick: (n: number) => { now = n; }, input: deploymentInput({ expiresAt: 10000 }) };
};
describe("deployment metadata, independent of application open/closed status", () => {
  it("stores identity and consumes each version once, including simultaneous worker claims", async () => {
    const { repo, input } = setup();
    const { deployment: r } = await repo.create(input);
    expect(r).toMatchObject({ state: "QUEUED", version: 1, imageRef: null, sandboxId: null, job: { status: "QUEUED", attempt: 0 } });
    const claims = await Promise.allSettled(["worker-1", "worker-2"].map(workerId => repo.command(r.id, 1, { type: "start", workerId })));
    expect(claims.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(claims.filter(r => r.status === "rejected")[0]).toMatchObject({ reason: { code: "version_conflict" } });
    const read = (await repo.find(r.id))!; read.job.attempt = 10;
    expect((await repo.find(r.id))?.job.attempt).toBe(1);
    expect(await repo.listByApp(input.appId)).toHaveLength(1);
    expect(await repo.find("c".repeat(24))).toBeNull();
  });
  it("deduplicates create even after expiry and rejects changed intent or occupied hostname", async () => {
    const { repo, input, tick } = setup();
    const first = await repo.create(input);
    const again = await repo.create(input);
    expect(again).toEqual({ created: false, deployment: first.deployment });
    await expect(repo.create({ ...input, templateVersion: "v2" })).rejects.toMatchObject({ code: "idempotency_conflict" });
    await expect(repo.create({ ...input, idempotencyKey: "other" })).rejects.toMatchObject({ code: "hostname_conflict" });
    tick(11000);
    expect((await repo.create(input)).deployment.id).toBe(first.deployment.id);
    await expect(repo.create({ ...input, idempotencyKey: "late" })).rejects.toMatchObject({ code: "expired" });
  });
  it("requires immutable image, resource IDs and HTTPS gateway verification before RUNNING", async () => {
    const { repo, input } = setup(); let r = (await repo.create(input)).deployment;
    const step = async (c: DeploymentCommand) => { r = await repo.command(r.id, r.version, c); };
    await expect(step({ type: "ready", verifiedUrl: `https://${r.hostname}/` })).rejects.toMatchObject({ code: "invalid_transition" });
    await step({ type: "start", workerId: "vm-1" }); await step({ type: "build" });
    await expect(step({ type: "deploy", imageRef: "ghcr.io/95lab/runtime:latest" })).rejects.toThrow();
    await step({ type: "deploy", imageRef: deploymentImage });
    await expect(step({ type: "ready", verifiedUrl: `https://${r.hostname}/` })).rejects.toThrow();
    // Partial provisioning must survive DNS failures so the worker can reclaim its sandbox.
    await step({ type: "resources", sandboxId: "box-1", volumeId: "volume-1" });
    await expect(step({ type: "resources", sandboxId: "box-2" })).rejects.toMatchObject({ code: "invalid_transition" });
    await step({ type: "resources", dnsRecordId: "dns-1" });
    for (const verifiedUrl of [`http://${r.hostname}/`, `https://other.runtime.example/`, `https://${r.hostname}/fake`]) {
      await expect(step({ type: "ready", verifiedUrl })).rejects.toMatchObject({ code: "invalid_transition" });
    }
    await step({ type: "ready", verifiedUrl: `https://${r.hostname}/` });
    expect(r).toMatchObject({ state: "RUNNING", job: { status: "SUCCEEDED", attempt: 1 }, imageRef: deploymentImage, sandboxId: "box-1", gatewayVerifiedAt: 1000 });
    await step({ type: "suspend" }); expect(r.gatewayVerifiedAt).toBeNull();
    await step({ type: "resume", verifiedUrl: `https://${r.hostname}/` });
    expect(r.state).toBe("RUNNING");
  });
  it("keeps error history and resource reservations across bounded retries", async () => {
    const { repo, input } = setup(); let r = (await repo.create({ ...input, maxAttempts: 2 })).deployment;
    const step = async (c: DeploymentCommand) => { r = await repo.command(r.id, r.version, c); };
    await step({ type: "start", workerId: "vm-1" }); await step({ type: "build" }); await step({ type: "deploy", imageRef: deploymentImage });
    await step({ type: "resources", sandboxId: "box-1", volumeId: "data-1" });
    await step({ type: "fail", code: "dns_failed", retryable: true });
    expect(r.lastError).toMatchObject({ stage: "DEPLOYING", attempt: 1 });
    await step({ type: "retry" });
    expect(r.lastError).toBeNull(); expect(r.errors).toHaveLength(1); expect(r.sandboxId).toBe("box-1");
    await expect(step({ type: "start", workerId: "vm-2" })).rejects.toMatchObject({ code: "invalid_transition" });
    await step({ type: "start", workerId: "vm-1" });
    await step({ type: "fail", code: "generation_failed", retryable: true });
    await expect(step({ type: "retry" })).rejects.toMatchObject({ code: "attempts_exhausted" });
    expect(r.errors).toHaveLength(2);
    expect(r.job).toMatchObject({ status: "FAILED", attempt: 2 });
  });
  it("refuses nonretryable failures, stage mismatches and arbitrary secret-bearing error text", async () => {
    const { repo, input } = setup(); let r = (await repo.create(input)).deployment;
    r = await repo.command(r.id, r.version, { type: "start", workerId: "vm-1" });
    await expect(repo.command(r.id, r.version, { type: "fail", code: "dns_failed", retryable: true })).rejects.toMatchObject({ code: "invalid_transition" });
    r = await repo.command(r.id, r.version, { type: "fail", code: "generation_failed", retryable: false });
    await expect(repo.command(r.id, r.version, { type: "retry" })).rejects.toMatchObject({ code: "invalid_transition" });
    expect(DeploymentCommandSchema.safeParse({ type: "fail", code: "job_timeout", retryable: true, message: "private provider output" }).success).toBe(false);
  });
  it("expires unfinished jobs, fences late workers and releases hostnames only after confirmed cleanup", async () => {
    const { repo, input, tick } = setup(); let r = (await repo.create(input)).deployment;
    await expect(repo.command(r.id, r.version, { type: "expire" })).rejects.toThrow();
    r = await repo.command(r.id, r.version, { type: "start", workerId: "vm-1" });
    tick(10000);
    await expect(repo.command(r.id, r.version, { type: "build" })).rejects.toMatchObject({ code: "expired" });
    r = await repo.command(r.id, r.version, { type: "expire" });
    expect(r.job.status).toBe("CANCELLED");
    await expect(repo.create({ ...input, idempotencyKey: "new", expiresAt: 20000 })).rejects.toMatchObject({ code: "hostname_conflict" });
    expect(DeploymentCommandSchema.safeParse({ type: "delete", cleanupConfirmed: false }).success).toBe(false);
    r = await repo.command(r.id, r.version, { type: "delete", cleanupConfirmed: true });
    const next = await repo.create({ ...input, idempotencyKey: "new", expiresAt: 20000 });
    expect(next.deployment.id).not.toBe(r.id);
    await expect(repo.command(r.id, r.version, { type: "start", workerId: "vm-1" })).rejects.toThrow();
  });
  it("validates DNS names, image pins and persisted runtime invariants", async () => {
    for (const host of ["https://app.example", "*.runtime.example", "UPPER.example", "localhost", "-bad.example", "a.example/path"]) expect(HostnameSchema.safeParse(host).success).toBe(false);
    for (const image of ["runtime:latest", "https://ghcr.io/org/image", "--privileged", "registry/a@sha256:bad"]) expect(ImageRefSchema.safeParse(image).success).toBe(false);
    const { repo, input } = setup(); const r = (await repo.create(input)).deployment;
    expect(DeploymentRecordSchema.safeParse({ ...r, state: "RUNNING" }).success).toBe(false);
    expect(DeploymentRecordSchema.safeParse({ ...r, hostname: "a.example", hostTokenHash: "hidden" }).success).toBe(false);
  });
});
