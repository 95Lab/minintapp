import "server-only";
import { createClient } from "@supabase/supabase-js";
import { runtimeConfig } from "@/engine/config/runtime-config";

/** Request-scoped PKCE storage; only the pending verifier map is sealed into an HttpOnly cookie. */
function authClient(storage: Record<string,string>) {
  return createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey, { auth: {
    persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, flowType: "pkce",
    storage: { getItem: key=>storage[key]??null, setItem: (key,value)=>{storage[key]=value;}, removeItem: key=>{delete storage[key];} },
  }, global: { fetch: (input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(10000)}) } });
}
export async function sendMagicLink(email: string, redirectTo: string) {
  const storage: Record<string,string> = {};
  try {
    const { error } = await authClient(storage).auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: true } });
    return { error: error ? "auth_delivery_failed" : null, storage };
  } catch { return { error: "auth_delivery_failed", storage: {} }; }
}
export async function userFromAuthCode(code: string, storage: Record<string,string>, flowId?: string) {
  const { data, error } = await authClient(storage).auth.exchangeCodeForSession(code, flowId ? {flowId} : undefined);
  // Tokens remain in this request's memory and are never returned or persisted in browser storage.
  return error || !data.user?.email || !data.user.email_confirmed_at ? null : { userId: data.user.id, email: data.user.email.toLowerCase() };
}
