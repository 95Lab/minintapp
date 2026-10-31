import { lookup } from "node:dns";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";

export async function runtimeHealth(url: string, id: string, headers?: Record<string, string>, ingressHostname?: string) {
  // Node fetch does not preserve an overridden Host header. The local gateway
  // needs the app hostname while connecting to the loopback listener.
  // A public probe connects through the stable ingress name: resolving a new app
  // hostname here makes public resolvers cache NXDOMAIN for the zone's negative
  // TTL, which also breaks the share link for visitors using those resolvers.
  const resolveIngress: LookupFunction | undefined = ingressHostname ? (_hostname, options, callback) => lookup(ingressHostname, options, callback) : undefined;
  const pinned = resolveIngress ? { lookup: resolveIngress } : {};
  const request = url.startsWith("https:") ? httpsRequest : httpRequest;
  const result = headers || ingressHostname ? await new Promise<{ ok: boolean; body: unknown }>((resolve, reject) => {
    const req = request(url, { headers, signal: AbortSignal.timeout(3000), ...pinned }, (response) => {
      let data = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { data += chunk; if (data.length > 16384) req.destroy(new Error("Health response too large")); });
      response.on("error", reject);
      response.on("end", () => {
        try { resolve({ ok: response.statusCode === 200, body: JSON.parse(data) }); } catch { reject(new Error("Invalid health response")); }
      });
    });
    req.on("error", reject);
    req.end();
  }) : await fetch(url, { signal: AbortSignal.timeout(3000) }).then(async (response) => ({ ok: response.ok, body: await response.json() }));
  const body = result.body as { service?: string; appId?: string } | null;
  if (!result.ok || body?.service !== "minintapp" || body?.appId !== id) throw new Error("Runtime health check failed");
}
