import "server-only";
import { readRuntimeConfig } from "@/lib/config/runtime-config";
import { MemoryAppsRepository } from "./memory-apps-repository";
import { SupabaseAppsRepository, supabaseRpc } from "./supabase-apps-repository";
import type { AppsRepository } from "./apps-repository-types";
const processState = globalThis as typeof globalThis & { minintMemoryRepository?: MemoryAppsRepository };
let database: SupabaseAppsRepository | undefined;
function repository(): AppsRepository {
  const env = readRuntimeConfig();
  if (env.APP_STORAGE === "supabase") return database ??= new SupabaseAppsRepository(supabaseRpc(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY));
  return processState.minintMemoryRepository ??= new MemoryAppsRepository();
}
// Lazy configuration keeps builds credential-free. A database error never falls back to memory.
export const appsRepository: AppsRepository = {
  createApp: (...args) => repository().createApp(...args),
  snapshot: (...args) => repository().snapshot(...args),
  findApp: (...args) => repository().findApp(...args),
  listResponses: (...args) => repository().listResponses(...args),
  submitResponse: (...args) => repository().submitResponse(...args),
  blockAction: (...args) => repository().blockAction(...args),
  transition: (...args) => repository().transition(...args),
};
