import "server-only";
import { MemoryAppsRepository } from "./memory-apps-repository";
import { ControlPlaneAppsRepository } from "@/lib/control-plane/apps-repository";
import { createRuntimeRepository } from "@/lib/runtime-plane/sqlite-apps-repository";
import type { AppsRepository } from "./apps-repository-types";
// Shared by route bundles and preserved across local hot reloads. Single-process storage only.
const processState = globalThis as typeof globalThis & { minintMemoryRepository?: AppsRepository };
function createRepository(): AppsRepository {
  if (process.env.PLATFORM_ROLE === "control") return new ControlPlaneAppsRepository();
  if (process.env.PLATFORM_ROLE === "runtime") {
    const seed = JSON.parse(Buffer.from(process.env.RUNTIME_SEED || "", "base64").toString("utf8"));
    if (seed.id !== process.env.RUNTIME_APP_ID) throw new Error("Runtime identity mismatch");
    return createRuntimeRepository("/data/app.sqlite", seed);
  }
  return new MemoryAppsRepository();
}
export const appsRepository = processState.minintMemoryRepository ??= createRepository();
