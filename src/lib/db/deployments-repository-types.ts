import type { CreateDeployment, DeploymentCommand, DeploymentRecord } from "@/lib/deployments/deployment-schema";

/** Internal, server-side metadata. Never use as a public response or accept worker commands from a participant. */
export interface DeploymentsRepository {
  /** Same app + key + intent returns the original record; changed intent or a reserved hostname conflicts. */
  create(input: CreateDeployment): Promise<{ created: boolean; deployment: DeploymentRecord }>;
  find(id: string): Promise<DeploymentRecord | null>;
  listByApp(appId: string): Promise<DeploymentRecord[]>;
  /** Optimistic lock: exactly one command can consume a version. No automatic network retry. */
  command(id: string, expectedVersion: number, command: DeploymentCommand): Promise<DeploymentRecord>;
}
