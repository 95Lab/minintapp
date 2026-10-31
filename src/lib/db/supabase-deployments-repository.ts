import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/api/app-error-codes";
import { DeploymentRecordSchema, type CreateDeployment, type DeploymentCommand } from "@/lib/deployments/deployment-schema";
import { applyDeploymentCommand, createDeployment, DeploymentConflict } from "@/lib/deployments/deployment-state";
import type { DeploymentsRepository } from "./deployments-repository-types";
import type { SupabaseRpc } from "./supabase-apps-repository";

const ReadSchema = z.object({ deployment: DeploymentRecordSchema, now: z.number().int().nonnegative() });
const OutcomeSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.enum(["created", "existing", "ok"]), deployment: DeploymentRecordSchema }),
  z.object({ outcome: z.enum(["idempotency_conflict", "hostname_conflict", "version_conflict", "not_found", "expired"]) }),
]);
function checked<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) throw new AppError("storage_unavailable");
  return result.data;
}
export class SupabaseDeploymentsRepository implements DeploymentsRepository {
  constructor(private readonly rpc: SupabaseRpc) {}
  async create(input: CreateDeployment) {
    const result = checked(OutcomeSchema, await this.rpc("minint_deployment_create", { p_document: createDeployment(input, Date.now()) }, AbortSignal.timeout(8000)));
    if (!('deployment' in result)) throw new DeploymentConflict(result.outcome);
    if (!["created", "existing"].includes(result.outcome)) throw new AppError("storage_unavailable");
    return { created: result.outcome === "created", deployment: result.deployment };
  }
  async find(id: string) {
    const raw = await this.rpc("minint_deployment_read", { p_id: id }, AbortSignal.timeout(8000));
    return raw === null ? null : checked(ReadSchema, raw).deployment;
  }
  async listByApp(appId: string) {
    return checked(z.array(DeploymentRecordSchema), await this.rpc("minint_deployment_list", { p_app_id: appId }, AbortSignal.timeout(8000)));
  }
  async command(id: string, expectedVersion: number, command: DeploymentCommand) {
    const signal = AbortSignal.timeout(8000);
    const raw = await this.rpc("minint_deployment_read", { p_id: id }, signal);
    if (raw === null) throw new DeploymentConflict("not_found");
    const current = checked(ReadSchema, raw);
    if (current.deployment.version !== expectedVersion) throw new DeploymentConflict("version_conflict");
    const next = applyDeploymentCommand(current.deployment, command, current.now);
    const result = checked(OutcomeSchema, await this.rpc("minint_deployment_commit", { p_id: id, p_expected_version: expectedVersion, p_document: next }, signal));
    if (!('deployment' in result)) throw new DeploymentConflict(result.outcome);
    if (result.outcome !== "ok") throw new AppError("storage_unavailable");
    return result.deployment;
  }
}
