import { managedEngineGeneration } from "@/lib/control-plane/engine-generation";
import {secureRoute} from "@/engine/api/secure-route";
// POST /api/engine/generate — prompt → AppSpec → new app. Streams NDJSON progress events so the
// UI can show "thinking → validating → done". Moderation runs in parallel with generation and
// the whole request shares one 18s deadline.
import type { GenerateEvent } from "@/engine/api/api-contract-types";
import { LIFETIME_MS } from "@/engine/api/api-contract-types";
import { GenerateRequestSchema, parseBody } from "@/engine/api/request-schemas";
import { appsRepository } from "@/engine/db/apps-repository";
import { GENERATION_DEADLINE_MS, generateAppSpec } from "@/engine/generation/generate-app-spec";
import { checkRateLimit, clientIpHash, isObviousPhishingPrompt, isPresenter, logSecurityEvent, moderatePrompt, scanAppSpec } from "@/engine/security/security-interfaces";
import { jsonError } from "@/engine/api/route-helpers";
import { errorText } from "@/engine/api/app-error-codes";
import { detectLocale } from "@/engine/generation/mock-prompt-safety-rules";
import { readSession } from "@/engine/auth/host-session";

export const maxDuration = 30;

async function handlePOST(req: Request) {
  if (process.env.PLATFORM_ROLE === "runtime") return Response.json({ ok: false, code: "forbidden" }, { status: 403 });
  const body = await parseBody(req, GenerateRequestSchema);
  if (!body) return jsonError(400, "prompt_invalid");
  const { prompt, lifetime } = body;
  const ipHash = clientIpHash(req);

  if (!isPresenter(req)) {
    const limit = await checkRateLimit("generate", ipHash);
    if (!limit.ok) return jsonError(429, "create_rate_limited", { minutes: Math.ceil((limit.retryAfterSec ?? 60) / 60) });
  }

  if (process.env.PLATFORM_ROLE === "control") return managedEngineGeneration(req, { prompt, lifetime, ownerId: readSession(req)?.userId });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: GenerateEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      const signal = AbortSignal.any([req.signal, AbortSignal.timeout(GENERATION_DEADLINE_MS)]);
      try {
        send({ stage: "thinking" });
        // Obvious phishing is refused before any model call (instant, no quota, no latency risk).
        if (isObviousPhishingPrompt(prompt)) {
          await logSecurityEvent("generate_refused", { ipHash, detail: { prompt: prompt.slice(0, 500), reason: "precheck:phishing_keywords" } });
          send({ stage: "refused", code: "generate_refused", message: errorText("generate_refused", "vi"), suggestion: errorText("phishing_suggestion", detectLocale(prompt)) });
          return;
        }
        const [moderation, output] = await Promise.all([moderatePrompt(prompt), generateAppSpec(prompt, { signal })]);
        send({ stage: "validating" });
        const scan = output.spec ? scanAppSpec(output.spec, output.riskFlags) : { ok: true, issues: [] };
        if (!moderation.ok || output.outcome === "refused" || !scan.ok) {
          const reason = !moderation.ok ? `moderation:${moderation.reason ?? "flagged"}` : output.outcome === "refused" ? `model:${output.riskFlags.join(",")}` : `scan:${scan.issues.join(",")}`;
          await logSecurityEvent("generate_refused", { ipHash, detail: { prompt: prompt.slice(0, 500), reason } });
          send({ stage: "refused", code: "generate_refused", message: errorText("generate_refused", "vi"), suggestion: output.suggestion, generation: output.generation });
        } else if (output.outcome !== "ok" || !output.spec) {
          send({ stage: "unsupported", code: "generate_unsupported", message: errorText("generate_unsupported", "vi"), suggestion: output.suggestion, generation: output.generation });
        } else if (!req.signal.aborted) {
          const { app, hostToken } = await appsRepository().createApp({ spec: output.spec, prompt, lifetimeMs: LIFETIME_MS[lifetime], ownerId: readSession(req)?.userId });
          if (output.generation) console.info("[generate]", { app: app.id, ...output.generation });
          send({ stage: "done", id: app.id, hostToken, generation: output.generation });
        }
      } catch {
        send({ stage: "error", code: "generate_failed", message: errorText("generate_failed", "vi") });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}

export const POST=(...args:Parameters<typeof handlePOST>)=>secureRoute(args[0],()=>handlePOST(...args));
