import "server-only";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { PlanningRequestSchema, PLANNING_TIMEOUT_MS } from "../src/lib/api/planning-contract";
import { planApp } from "../src/lib/generation/plan-app";
import { generationBudget } from "../src/lib/generation/generation-budget";
import { readRuntimeConfig } from "../src/lib/config/runtime-config";
import { AppError } from "../src/lib/api/app-error-codes";
import { errorResponse } from "../src/lib/api/route-helpers";

export async function handleWorkerPlanning(request: IncomingMessage, response: ServerResponse) {
  const abort = new AbortController();
  const disconnected = () => { if (!response.writableEnded) abort.abort(); };
  response.once("close", disconnected);
  let release: (() => void) | undefined;
  let locale: "vi" | "en" = "vi";
  try {
    const expected = process.env.WORKER_TOKEN;
    const token = request.headers.authorization?.replace(/^Bearer /, "") || "";
    if (!expected || !timingSafeEqual(createHash("sha256").update(token).digest(), createHash("sha256").update(expected).digest())) {
      throw new AppError("forbidden");
    }
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 16384) throw new AppError("invalid_request");
      chunks.push(Buffer.from(chunk));
    }
    let value: unknown;
    try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new AppError("invalid_request"); }
    const parsed = PlanningRequestSchema.safeParse(value);
    if (!parsed.success) throw new AppError("invalid_request");
    locale = parsed.data.locale;
    const config = readRuntimeConfig();
    if (!config.OPENAI_API_KEY) throw new AppError("ai_not_configured");
    release = generationBudget.acquire(config.GENERATION_MAX_PER_HOUR, config.GENERATION_MAX_CONCURRENT);
    const result = await planApp(parsed.data, AbortSignal.any([abort.signal, AbortSignal.timeout(PLANNING_TIMEOUT_MS)]));
    if (!response.destroyed) response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify(result));
  } catch (error) {
    if (!response.destroyed) {
      const safe = errorResponse(error, locale);
      response.writeHead(safe.status, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(await safe.text());
    }
  } finally { release?.(); response.off("close", disconnected); }
}
