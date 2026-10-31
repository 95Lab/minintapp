"use client";
// Browser Supabase client (anon key) used ONLY to subscribe to payload-less "changed" signals.
// The anon role has no table access (RLS + revoked grants); all data comes from our API.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!client) client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
