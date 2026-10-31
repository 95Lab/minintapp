import "server-only";
import type { DeploymentsRepository } from "./deployments-repository-types";
import { createDeployment, applyDeploymentCommand, sameDeploymentIntent, DeploymentConflict } from "@/lib/deployments/deployment-state";
import type { CreateDeployment, DeploymentCommand, DeploymentRecord } from "@/lib/deployments/deployment-schema";

export class MemoryDeploymentsRepository implements DeploymentsRepository {
  private readonly records = new Map<string, DeploymentRecord>();
  constructor(private readonly now = Date.now) {}
  async create(input: CreateDeployment) {
    const candidate = createDeployment(input, this.now());
    for (const record of this.records.values()) {
      if (record.appId === candidate.appId && record.idempotencyKey === candidate.idempotencyKey) {
        if (!sameDeploymentIntent(record, candidate)) throw new DeploymentConflict("idempotency_conflict");
        return { created: false, deployment: structuredClone(record) };
      }
    }
    if ([...this.records.values()].some(r => r.hostname === candidate.hostname && r.state !== "DELETED")) throw new DeploymentConflict("hostname_conflict");
    this.records.set(candidate.id, candidate);
    return { created: true, deployment: structuredClone(candidate) };
  }
  async find(id: string) { return structuredClone(this.records.get(id) ?? null); }
  async listByApp(appId: string) { return structuredClone([...this.records.values()].filter(r => r.appId === appId).sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))); }
  async command(id: string, expectedVersion: number, command: DeploymentCommand) {
    const current = this.records.get(id);
    if (!current) throw new DeploymentConflict("not_found");
    if (current.version !== expectedVersion) throw new DeploymentConflict("version_conflict");
    const next = applyDeploymentCommand(current, command, this.now());
    this.records.set(id, next);
    return structuredClone(next);
  }
}
