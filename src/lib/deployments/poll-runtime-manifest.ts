import "server-only";
import { createHash } from "node:crypto";
import { AppSpecSchema, type AppSpec } from "@/engine/app-spec/app-spec-schema";
import { DeploymentRecordSchema, type DeploymentRecord } from "./deployment-schema";
import { PollRuntimeManifestSchema, type PollRuntimeManifest } from "@/lib/blocks/poll-runtime-schema";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
/** Hash the normalized, preset-expanded snapshot. Persist that exact spec for the builder. */
export function runtimeSpecHash(spec: AppSpec): string {
  return createHash("sha256").update(canonical(AppSpecSchema.parse(spec))).digest("hex");
}
export function createPollRuntimeManifest(rawSpec: unknown, rawDeployment: DeploymentRecord): PollRuntimeManifest {
  const spec = AppSpecSchema.parse(rawSpec);
  const deployment = DeploymentRecordSchema.parse(rawDeployment);
  if (deployment.templateVersion !== "poll-v1" || deployment.specHash !== runtimeSpecHash(spec)) throw new Error("poll_snapshot_mismatch");
  const block = spec.blocks[0];
  if (spec.blocks.length !== 1 || block.type !== "compose" || block.entries !== "one" || block.flow !== "open" || block.inputs.length !== 1 || block.views.length !== 1) throw new Error("unsupported_poll_spec");
  const input = block.inputs[0], view = block.views[0];
  if (input.kind !== "choice" || input.multi || !input.required || !input.options || input.showIf !== null || input.timeLimitSec !== null || input.capacity !== null || input.min !== null || input.max !== null || input.unit !== null || input.options.some(o => o.price !== null)
    || view.kind !== "bars" || view.source !== input.id || view.query !== null || view.topN !== null || view.op !== null || view.teams !== null || view.visibleTo === "after_step") throw new Error("unsupported_poll_spec");
  return PollRuntimeManifestSchema.parse({
    templateVersion: "poll-v1", appId: deployment.appId, deploymentId: deployment.id,
    specHash: deployment.specHash, hostname: deployment.hostname, expiresAt: deployment.expiresAt,
    locale: spec.locale, theme: spec.theme, title: spec.title, description: spec.description,
    blockTitle: block.title, note: block.note, question: input.label, resultsTitle: view.title ?? input.label,
    requireName: spec.requireName, options: input.options.map(({ id, label }) => ({ id, label })), resultsVisibility: view.visibleTo,
  });
}
