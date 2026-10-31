"use client";
import { createClient } from "@supabase/supabase-js";
import type { Subscribe } from "./state-sync";
export const subscribeToApp: Subscribe = (sync, changed, status) => {
  const client = createClient(sync.url, sync.publicKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  // The server is the source of truth. Ignore broadcast data, including forged versions.
  const channel = client.channel(sync.channel, { config: { private: false } })
    .on("broadcast", { event: "state_changed" }, changed)
    .subscribe(status);
  return () => { void client.removeChannel(channel); };
};
