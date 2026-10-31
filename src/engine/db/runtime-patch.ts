// What a host action changed in the app runtime, as a patch the store merges atomically
// (SQL patch_app_runtime / the in-memory store): changed top-level keys are replaced, and inside
// runtime.blocks only the changed keys of each block slot are written. Writing the whole runtime
// from a stale read would let two concurrent actions undo each other.
import type { AppRuntime } from "@/engine/blocks/block-definition-types";

export type RuntimePatch = Partial<Omit<AppRuntime, "blocks">> & { blocks?: Record<string, Record<string, unknown>> };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const asObject = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function runtimePatch(before: AppRuntime, after: AppRuntime): RuntimePatch {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(after)) {
    if (key !== "blocks" && !same(value, (before as unknown as Record<string, unknown>)[key])) patch[key] = value;
  }
  const blocks: Record<string, Record<string, unknown>> = {};
  for (const [id, slot] of Object.entries(after.blocks ?? {})) {
    const prev = asObject(before.blocks?.[id]);
    const changed = Object.fromEntries(Object.entries(asObject(slot)).filter(([k, v]) => !same(v, prev[k])));
    if (Object.keys(changed).length) blocks[id] = changed;
  }
  if (Object.keys(blocks).length) patch.blocks = blocks;
  return patch as RuntimePatch;
}

/** The same merge the SQL function does, for the in-memory store. */
export function applyRuntimePatch(runtime: AppRuntime, patch: RuntimePatch): AppRuntime {
  const { blocks: blockPatch, ...top } = patch;
  const blocks = { ...(runtime.blocks ?? {}) };
  for (const [id, changes] of Object.entries(blockPatch ?? {})) blocks[id] = { ...asObject(blocks[id]), ...changes };
  return { ...runtime, ...top, blocks };
}
