// Browser-side calls for host accounts. Same contract as api-client.ts: never throw, failures carry an error code.
import type { AccountAppsResponse, SessionResponse } from "@/engine/api/api-contract-types";
import { allHostTokens } from "@/engine/host/host-token-store";

type Failure = { ok: false; code: string; params?: Record<string, string | number> };
const NETWORK: Failure = { ok: false, code: "network" };

async function call<T>(url: string, init?: RequestInit): Promise<({ ok: true } & T) | Failure> {
  try {
    const res = await fetch(url, { cache: "no-store", ...init });
    const data = await res.json().catch(() => null);
    if (res.ok) return { ok: true, ...(data as T) };
    return { ok: false, code: typeof data?.code === "string" ? data.code : "unknown", params: data?.params };
  } catch {
    return NETWORK;
  }
}
const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export async function fetchSession(): Promise<SessionResponse | null> {
  const r = await call<SessionResponse>("/api/engine/auth/session");
  return r.ok ? { user: r.user, accountsEnabled: r.accountsEnabled } : null;
}

export const requestMagicLink = (email: string) => call<object>("/api/engine/auth/magic-link", post({ email }));
export const exchangeAccessToken = (accessToken: string) => call<object>("/api/engine/auth/session", post({ accessToken }));
export const signOut = () => call<object>("/api/engine/auth/session", { method: "DELETE" });
export const fetchAccountApps = () => call<AccountAppsResponse>("/api/engine/account");

/** "Save to my account": claims every app whose host token this browser holds. Returns how many are now owned. */
export async function claimLocalApps(): Promise<number> {
  const apps = allHostTokens().slice(0, 50);
  if (!apps.length) return 0;
  const r = await call<{ claimed: string[] }>("/api/engine/account/claim", post({ apps }));
  return r.ok ? r.claimed.length : 0;
}
