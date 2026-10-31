import "server-only";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import { PollRuntimeManifestSchema, type PollRuntimeManifest } from "../../src/lib/blocks/poll-runtime-schema.js";
import { PollHostActionSchema, PollVoteRequestSchema } from "../../src/lib/api/poll-runtime-contract.js";
import { PollError, PollRepository } from "./repository.js";

const BODY_LIMIT = 4096;
const headers = {
  "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
  "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, "content-type": "application/json; charset=utf-8" } });
class BodyError extends Error { constructor(readonly status: number) { super("invalid_request"); } }
async function body(req: Request): Promise<unknown> {
  if (req.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new BodyError(415);
  const reader = req.body?.getReader();
  if (!reader) throw new BodyError(400);
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.length;
      if (bytes > BODY_LIMIT) { await reader.cancel(); throw new BodyError(413); }
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new BodyError(400); }
  } finally { reader.releaseLock(); }
}
export interface PollServerOptions {
  repository: PollRepository;
  hostToken: string;
  /** Local development only: validated loopback origin; production always uses manifest.hostname. */
  localOrigin?: string;
  assets: { html: string; js: string; css: string };
}
function originFor(manifest: PollRuntimeManifest, localOrigin?: string) {
  if (!localOrigin) return `https://${manifest.hostname}`;
  const url = new URL(localOrigin);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.origin !== localOrigin) throw new Error("invalid_local_origin");
  return url.origin;
}
export function createPollHandler(options: PollServerOptions) {
  const { repository: repo, assets } = options;
  const origin = originFor(repo.manifest, options.localOrigin);
  if (!/^[a-f0-9]{64}$/.test(options.hostToken)) throw new Error("invalid_runtime_host_token");
  const hostHash = createHash("sha256").update(options.hostToken).digest();
  const secure = !options.localOrigin;
  const cookieName = secure ? "__Host-minint_poll" : "minint_poll_local";
  const cookie = (req: Request) => {
    const value = req.headers.get("cookie")?.split(";").map(c => c.trim()).find(c => c.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
  };
  const authenticated = (req: Request) => {
    const auth = req.headers.get("authorization");
    if (!auth) return false;
    const value = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    return timingSafeEqual(hostHash, createHash("sha256").update(value).digest());
  };
  return async (req: Request): Promise<Response> => {
    try {
      const url = new URL(req.url);
      const host = req.headers.get("host") ?? url.host;
      const health = req.method === "GET" && url.pathname === "/health";
      if (host !== new URL(origin).host && !(health && /^(127\.0\.0\.1|localhost)(:[0-9]+)?$/.test(host))) return json({ code: "wrong_hostname" }, 421);
      if (health) return json(repo.health());
      if (req.method === "POST" && req.headers.get("origin") !== origin) return json({ code: "forbidden_origin" }, 403);
      if (req.headers.has("authorization") && !authenticated(req)) return json({ code: "forbidden" }, 403);
      if (req.method === "GET" && ["/", "/host"].includes(url.pathname)) {
        repo.state(null); // Expired/ended runtimes serve no usable interface.
        return new Response(assets.html, { headers: { ...headers, "content-type": "text/html; charset=utf-8" } });
      }
      if (req.method === "GET" && ["/app.js", "/app.css"].includes(url.pathname)) {
        return new Response(url.pathname === "/app.js" ? assets.js : assets.css, { headers: { ...headers, "content-type": url.pathname === "/app.js" ? "text/javascript; charset=utf-8" : "text/css; charset=utf-8" } });
      }
      if (req.method === "GET" && url.pathname === "/api/state") {
        const existing = cookie(req), token = existing ?? randomBytes(32).toString("hex");
        const response = json(repo.state(token, authenticated(req)));
        if (!existing) response.headers.set("set-cookie", `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`);
        return response;
      }
      if (req.method === "POST" && url.pathname === "/api/votes") {
        const token = cookie(req);
        if (!token) return json({ code: "participant_cookie_required" }, 403);
        const parsed = PollVoteRequestSchema.safeParse(await body(req));
        if (!parsed.success) return json({ code: "invalid_vote" }, 400);
        return json(repo.vote(token, parsed.data));
      }
      if (req.method === "POST" && url.pathname === "/api/host") {
        if (!authenticated(req)) return json({ code: "forbidden" }, 403);
        const parsed = PollHostActionSchema.safeParse(await body(req));
        if (!parsed.success) return json({ code: "invalid_action" }, 400);
        repo.action(parsed.data.action);
        return parsed.data.action === "end" ? json({ status: "ended" }) : json(repo.state(cookie(req), true));
      }
      return json({ code: "not_found" }, 404);
    } catch (error) {
      if (error instanceof PollError && ["expired", "ended"].includes(error.code) && req.method === "GET" && ["/", "/host"].includes(new URL(req.url).pathname)) {
        const en = repo.manifest.locale === "en";
        const message = error.code === "expired" ? (en ? "This app has expired." : "Ứng dụng đã hết hạn.") : (en ? "This app has ended." : "Ứng dụng đã kết thúc.");
        return new Response(`<!doctype html><html lang="${en ? "en" : "vi"}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MinintApp</title><link rel="stylesheet" href="/app.css"><body><header><span class="brand">minintapp.</span></header><main><h1>${message}</h1></main></body></html>`, { status: 410, headers: { ...headers, "content-type": "text/html; charset=utf-8" } });
      }
      if (error instanceof PollError) return json({ code: error.code }, ["expired", "ended"].includes(error.code) ? 410 : error.code === "closed" ? 409 : error.code === "capacity_reached" ? 429 : 400);
      if (error instanceof BodyError) return json({ code: "invalid_request" }, error.status);
      return json({ code: "runtime_unavailable" }, 503);
    }
  };
}

/** Node HTTP adapter; the handler is also exercised without sockets by unit tests. */
export function pollHttpServer(handler: ReturnType<typeof createPollHandler>, origin: string) {
  const server = createServer(async (incoming, outgoing) => {
    try {
      if (Number(incoming.headers["content-length"] ?? 0) > BODY_LIMIT) {
        outgoing.writeHead(413, { ...headers, "connection": "close", "content-type": "application/json" }); outgoing.end('{"code":"invalid_request"}'); return;
      }
      const requestHeaders = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) if (value !== undefined) requestHeaders.set(key, Array.isArray(value) ? value.join(", ") : value);
      const controller = new AbortController();
      incoming.on("aborted", () => controller.abort());
      const init: RequestInit & { duplex?: "half" } = { method: incoming.method, headers: requestHeaders, signal: controller.signal };
      if (!["GET", "HEAD"].includes(incoming.method ?? "GET")) { init.body = Readable.toWeb(incoming as IncomingMessage) as ReadableStream<Uint8Array>; init.duplex = "half"; }
      const response = await handler(new Request(new URL(incoming.url ?? "/", origin), init));
      outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch { if (!outgoing.headersSent) outgoing.writeHead(503, headers); outgoing.end(); }
  });
  server.requestTimeout = 10_000; server.headersTimeout = 10_000; server.maxHeadersCount = 40; server.keepAliveTimeout = 5_000;
  return server;
}

export function loadRuntime() {
  const configFile = process.env.POLL_MANIFEST_FILE ?? "/config/manifest.json";
  const file = readFileSync(configFile);
  if (file.length > 16384) throw new Error("manifest_too_large");
  const manifest = PollRuntimeManifestSchema.parse(JSON.parse(file.toString("utf8")));
  const hostToken = readFileSync(process.env.POLL_HOST_TOKEN_FILE ?? "/run/secrets/poll-host-token", "utf8").trim();
  const assets = { html: readFileSync(new URL("./public/index.html", import.meta.url), "utf8"), js: readFileSync(new URL("./public/app.js", import.meta.url), "utf8"), css: readFileSync(new URL("./public/app.css", import.meta.url), "utf8") };
  const origin = originFor(manifest, process.env.POLL_LOCAL_ORIGIN);
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("invalid_runtime_port");
  const repository = new PollRepository(process.env.POLL_DB_FILE ?? "/data/poll.sqlite", manifest);
  try {
    const handler = createPollHandler({ repository, assets, hostToken, localOrigin: process.env.POLL_LOCAL_ORIGIN });
    const server = pollHttpServer(handler, origin);
    return { server, repository, port, hostname: process.env.POLL_LOCAL_ORIGIN ? "127.0.0.1" : "0.0.0.0" };
  } catch (error) { repository.close(); throw error; }
}
