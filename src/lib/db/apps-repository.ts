import "server-only";
import { readRuntimeConfig } from "@/lib/config/runtime-config";
import { MemoryAppsRepository } from "./memory-apps-repository";
import { SupabaseAppsRepository, supabaseRpc } from "./supabase-apps-repository";
import type { AppsRepository } from "./apps-repository-types";
const processState = globalThis as typeof globalThis & { minintMemoryRepository?: MemoryAppsRepository };
let database: SupabaseAppsRepository | undefined;
function repository(): AppsRepository {
  const env = readRuntimeConfig();
  if (env.APP_STORAGE === "supabase") return database ??= new SupabaseAppsRepository(supabaseRpc(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY),async(userId)=>{
    const {supabaseServer}=await import("@/engine/db/supabase-server-client");
    const {data,error}=await supabaseServer().from("minint_app_snapshots").select("document").eq("document->app->>ownerId",userId).limit(200);
    if(error)throw new Error("storage_unavailable");
    return (data??[]).map(r=>r.document.app).filter(a=>a.status!=="ended"&&a.status!=="blocked"&&a.expiresAt>Date.now()).sort((a,b)=>b.createdAt-a.createdAt);
  });
  return processState.minintMemoryRepository ??= new MemoryAppsRepository();
}
// Lazy configuration keeps builds credential-free. A database error never falls back to memory.
export const appsRepository: AppsRepository = {
  mutateSnapshot: (id,mutate)=>repository().mutateSnapshot(id,mutate),
  listAppsByOwner: (...args)=>repository().listAppsByOwner(...args),
  createApp: (...args) => repository().createApp(...args),
  snapshot: (...args) => repository().snapshot(...args),
  findApp: (...args) => repository().findApp(...args),
  listResponses: (...args) => repository().listResponses(...args),
  submitResponse: (...args) => repository().submitResponse(...args),
  blockAction: (...args) => repository().blockAction(...args),
  transition: (...args) => repository().transition(...args),
};
