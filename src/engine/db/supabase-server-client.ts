// Server-only Supabase client using the service role (bypasses RLS). Never import from client code.
// Holds secrets: importing this from a client component fails the build.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runtimeConfig } from "@/engine/config/runtime-config";

let client: SupabaseClient | null = null;

const RETRY_DELAYS_MS = [50, 200];

/**
 * Retries a request that failed at the NETWORK level (fetch threw: reset connection, gateway
 * overloaded by a burst). HTTP errors are returned untouched. Safe because every write here is
 * idempotent: answers upsert by key, deletes/merges are repeatable, rate-limit counters over-count
 * at worst, and new rows get fresh random ids.
 */
async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const headers=new Headers(init?.headers);
      if(headers.get("authorization")?.startsWith("Bearer sb_"))headers.delete("authorization");
      return await fetch(input,{...init,headers,signal:init?.signal?AbortSignal.any([init.signal,AbortSignal.timeout(8000)]):AbortSignal.timeout(8000)});
    } catch (err) {
      if (init?.signal?.aborted || attempt >= RETRY_DELAYS_MS.length) throw err;
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt] + Math.random() * 50));
    }
  }
}

export function supabaseServer(): SupabaseClient {
  if (!client) {
    client = createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchWithRetry },
    });
  }
  return client;
}
