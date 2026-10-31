import { z } from "zod";
const Version = z.number().int().positive().max(2147483647);
export const ManagedImageSchema = z.string().regex(/^ghcr\.io\/95lab\/minintapp@sha256:[a-f0-9]{64}$/);
export const DeploymentActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suspend") }).strict(),
  z.object({ action: z.literal("resume") }).strict(),
  z.object({ action: z.literal("delete") }).strict(),
  z.object({ action: z.literal("deploy"), image: ManagedImageSchema, expectedVersion: Version }).strict(),
  z.object({ action: z.literal("rollback"), version: Version, expectedVersion: Version }).strict(),
]);
export const DeploymentLogSchema = z.object({
  id: z.string(), at: z.string(), source: z.enum(["deployment", "runtime"]), message: z.string().max(4096),
});
export const DeploymentManagementSchema = z.object({
  state: z.string(), activeVersion: Version.nullable(), requestedVersion: Version.nullable(),
  versions: z.array(z.object({ version: Version, image: ManagedImageSchema, specDigest: z.string(),
    status: z.enum(["PENDING", "SUCCEEDED", "FAILED"]), previousVersion: Version.nullable(), rollbackOf: Version.nullable(),
    createdAt: z.string(), completedAt: z.string().nullable() })),
  images: z.array(ManagedImageSchema), logs: z.array(DeploymentLogSchema),
  runtimeLogsAvailable: z.boolean(),
});
export type DeploymentAction = z.infer<typeof DeploymentActionSchema>;
export type DeploymentManagement = z.infer<typeof DeploymentManagementSchema>;
export type DeploymentLog = z.infer<typeof DeploymentLogSchema>;
