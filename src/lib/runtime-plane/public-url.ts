import "server-only";

const appIdPattern = /^[a-f0-9]{24}$/;
const domainPattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}$/;

/** Public navigation only: never attach host credentials to a cross-origin URL. */
export function runtimePublicUrl(id: string): string | undefined {
  if (!appIdPattern.test(id)) return undefined;
  let domain: string | undefined;
  if (process.env.PLATFORM_ROLE === "control") domain = process.env.APPS_DOMAIN;
  if (process.env.PLATFORM_ROLE === "runtime") {
    // Derive sibling app origins from the worker-provided origin, never request Host.
    const ownId = process.env.RUNTIME_APP_ID;
    if (!ownId || !appIdPattern.test(ownId)) return undefined;
    try {
      const origin = new URL(process.env.APP_ORIGIN || "");
      if (origin.protocol !== "https:" || origin.port || origin.username || origin.password || !origin.hostname.startsWith(`${ownId}.`)) return undefined;
      domain = origin.hostname.slice(ownId.length + 1);
    } catch { return undefined; }
  }
  if (!domain || domain.length > 228 || !domainPattern.test(domain)) return undefined;
  return `https://${id}.${domain}/rooms/${id}`;
}
