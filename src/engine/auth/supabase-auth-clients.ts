// Supabase Auth calls made by the server. Supabase only proves "this person controls this email"; our
// own session cookie (host-session.ts) carries that fact afterwards, so no Supabase token is stored
// in the browser and no auth library is added.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { runtimeConfig } from "@/engine/config/runtime-config";
import { supabaseServer } from "@/engine/db/supabase-server-client";

/** Asks Supabase Auth to email a magic link (implicit flow: the link returns with #access_token). */
export async function sendMagicLink(email: string, redirectTo: string): Promise<{ error: string | null }> {
  const anon = createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" } });
  const { error } = await anon.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: true } });
  return { error: error?.message ?? null };
}

/** Verifies an access token with Supabase Auth; null when it is invalid, expired, or has no email. */
export async function userFromAccessToken(token: string): Promise<{ userId: string; email: string } | null> {
  const { data, error } = await supabaseServer().auth.getUser(token);
  return error || !data.user?.email ? null : { userId: data.user.id, email: data.user.email.toLowerCase() };
}
