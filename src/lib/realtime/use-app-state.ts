"use client";
import { useCallback, useEffect, useState } from "react";
import type { AppStateResponse } from "@/lib/api/api-contract-types";
import { ApiClientError, readState } from "@/lib/api/api-client";
import { startStateSync } from "./state-sync";
import { subscribeToApp } from "./supabase-subscription";
export function useAppState(id: string, host: boolean, token: string | null) {
  const [state, setState] = useState<AppStateResponse | null>(null);
  const [error, setError] = useState("");
  const [failureStatus, setFailureStatus] = useState<number | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await readState(id, host, token, signal);
      if (signal?.aborted) return false;
      setState((previous) => !previous || previous.id !== next.id || previous.isHost !== next.isHost || next.stateVersion >= previous.stateVersion ? next : previous);
      setError(""); setFailureStatus(null); return true;
    } catch (error) {
      if (signal?.aborted) return false;
      setError(error instanceof ApiClientError ? error.message : "Mất kết nối. Đang thử lại…");
      setFailureStatus(error instanceof ApiClientError ? error.status : 0); return false;
    }
  }, [id, host, token]);
  useEffect(() => {
    if (!host && !token) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      if (!await refresh(controller.signal) && !controller.signal.aborted) timer = setTimeout(load, 2500);
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [refresh, host, token]);
  const current = state?.id === id && state.isHost === host ? state : null;
  const mode = current?.sync?.mode;
  const config = current?.sync?.mode === "supabase" ? current.sync : null;
  const url = config?.url, publicKey = config?.publicKey, channel = config?.channel;
  const expiresAt = current?.expiresAt;
  useEffect(() => {
    if (!expiresAt || failureStatus === 403 || failureStatus === 404 || failureStatus === 410) return;
    const controller = new AbortController();
    const stop = startStateSync({ sync: mode === "supabase" && url && publicKey && channel ? { mode, url, publicKey, channel } : { mode: "memory" }, refresh: () => refresh(controller.signal), subscribe: subscribeToApp, events: window });
    const expiryTimer = setTimeout(() => void refresh(controller.signal), Math.max(0, new Date(expiresAt).getTime() - Date.now()) + 100);
    return () => { controller.abort(); stop(); clearTimeout(expiryTimer); };
  }, [refresh, mode, url, publicKey, channel, expiresAt, failureStatus]);
  return { state: current, error, failureStatus, refresh };
}
