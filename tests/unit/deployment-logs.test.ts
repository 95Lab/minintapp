import { expect, it } from "vitest";
import { redactLogs } from "../../platform/logs";
import { DeploymentActionSchema } from "@/lib/api/deployment-management-contract";
it("redacts runtime capabilities, database credentials and common secret formats", () => {
  const value = 'DATABASE_URL=postgresql://user:private-password@db/app token="private-token" authorization: Bearer capability-value hostTokenHash=' + "a".repeat(64) + ' sk-example-key opaque-capability-value';
  const safe = redactLogs(value, ["opaque-capability-value"]);
  for (const secret of ["private-password", "private-token", "capability-value", "a".repeat(64), "sk-example-key"]) expect(safe).not.toContain(secret);
  expect(safe).toContain("[REDACTED]");
});
it("requires an expected version and an approved immutable image format for deployments", () => {
  expect(DeploymentActionSchema.safeParse({ action: "rollback", version: 1 }).success).toBe(false);
  expect(DeploymentActionSchema.safeParse({ action: "deploy", expectedVersion: 1, image: "untrusted:latest" }).success).toBe(false);
  expect(DeploymentActionSchema.safeParse({ action: "rollback", expectedVersion: 2, version: 1 }).success).toBe(true);
  expect(DeploymentActionSchema.safeParse({ action: "delete", image: "ignored" }).success).toBe(false);
});
