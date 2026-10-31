import { request } from "node:http";

export async function runtimeHealth(url: string, id: string, headers?: Record<string, string>) {
  // Node fetch does not preserve an overridden Host header. The local gateway
  // needs the app hostname while connecting to the loopback listener.
  const result = headers ? await new Promise<{ ok: boolean; body: unknown }>((resolve, reject) => {
    const req = request(url, { headers, signal: AbortSignal.timeout(3000) }, (response) => {
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
