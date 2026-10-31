"use client";
import { useCallback, useEffect, useState } from "react";
import type { AppStateResponse } from "@/lib/api/api-contract-types";
import { ApiClientError, readState } from "@/lib/api/api-client";
export function useAppState(id: string, host: boolean, token: string | null) {
  const [state, setState] = useState<AppStateResponse | null>(null);
  const [error, setError] = useState("");
  const [failureStatus, setFailureStatus] = useState<number | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await readState(id, host, token, signal);
      if (signal?.aborted) return;
      setState((previous) => !previous || previous.id !== next.id || previous.isHost !== next.isHost || next.stateVersion >= previous.stateVersion ? next : previous);
      setError(""); setFailureStatus(null);
    } catch (error) {
      if (signal?.aborted) return;
      setError(error instanceof ApiClientError ? error.message : "Mất kết nối. Đang thử lại…");
      setFailureStatus(error instanceof ApiClientError ? error.status : 0);
    }
  }, [id, host, token]);
  useEffect(() => {
    if (!host && !token) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      await refresh(controller.signal);
      if (!controller.signal.aborted) timer = setTimeout(poll, 1500);
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [refresh, host, token]);
  return { state: state?.id === id && state.isHost === host ? state : null, error, failureStatus, refresh };
}
