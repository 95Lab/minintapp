import type { CreateDeployment } from "@/lib/deployments/deployment-schema";
export const deploymentImage = `ghcr.io/95lab/minint-runtime@sha256:${"a".repeat(64)}`;
export function deploymentInput(overrides: Partial<CreateDeployment> = {}): CreateDeployment {
  return { appId: "a".repeat(24), idempotencyKey: "create-1", hostname: "poll-abc.runtime.example", specHash: "b".repeat(64), templateVersion: "poll-v1", expiresAt: Date.now() + 3600_000, maxAttempts: 3, ...overrides };
}
