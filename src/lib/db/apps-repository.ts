import "server-only";
import { MemoryAppsRepository } from "./memory-apps-repository";
// Shared by route bundles and preserved across local hot reloads. Single-process storage only.
const processState = globalThis as typeof globalThis & { minintMemoryRepository?: MemoryAppsRepository };
export const appsRepository = processState.minintMemoryRepository ??= new MemoryAppsRepository();
