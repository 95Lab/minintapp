import "server-only";
import { readRuntimeConfig } from "@/lib/config/runtime-config";
import { supabaseRpc } from "./supabase-apps-repository";
import { MemoryDeploymentsRepository } from "./memory-deployments-repository";
import { SupabaseDeploymentsRepository } from "./supabase-deployments-repository";
import type { DeploymentsRepository } from "./deployments-repository-types";

const state = globalThis as typeof globalThis & { minintMemoryDeployments?: MemoryDeploymentsRepository };
let database: SupabaseDeploymentsRepository | undefined;
/** Same explicit storage choice as app records; database errors never fall back to memory. */
export function deploymentsRepository(): DeploymentsRepository {
  const env = readRuntimeConfig();
  if (env.APP_STORAGE === "supabase") return database ??= new SupabaseDeploymentsRepository(supabaseRpc(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY));
  return state.minintMemoryDeployments ??= new MemoryDeploymentsRepository();
}
