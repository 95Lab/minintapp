import "server-only";
import { createManagedApp } from "./deployments";
import { deployment } from "../../../platform/store";
import { NextResponse } from "next/server";
import { secureHostCookie, hostCookieName } from "@/lib/host/host-session";
import type { Deployment } from "../../../platform/contracts";
export async function managedEngineGeneration(request: Request, input: Deployment["input"]) {
  const created = await createManagedApp(request, { ...input, engine: true });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({ async start(controller) {
    const send = (value: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
    try {
      send({ stage: "thinking" });
      for (let attempt = 0; attempt < 180; attempt++) {
        if (request.signal.aborted) return;
        const current = await deployment(created.id);
        if (current?.state === "RUNNING") { send({ stage: "done", id: created.id, hostToken: created.hostToken, generation: current.generation }); return; }
        if (!current || ["FAILED", "EXPIRED", "DELETED"].includes(current.state)) { send({ stage: "error", code: "generate_failed", message: "Không thể triển khai ứng dụng." }); return; }
        if (attempt === 2) send({ stage: "validating" });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      send({ stage: "error", code: "generate_failed", message: "Ứng dụng vẫn đang triển khai. Xem dashboard." });
    } finally { controller.close(); }
  } });
  const response = new NextResponse(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
  response.cookies.set(created.tenant.cookieName, created.tenant.token, { httpOnly: true, sameSite: "strict", secure: secureHostCookie(request), path: "/", maxAge: 30 * 86400 });
  response.cookies.set(hostCookieName(created.id), created.hostToken, { httpOnly: true, sameSite: "lax", secure: secureHostCookie(request), path: "/api/engine", maxAge: 7 * 86400 });
  return response;
}
