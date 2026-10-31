import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { createManagedApp } = vi.hoisted(() => ({ createManagedApp: vi.fn() }));
vi.mock("@/lib/control-plane/deployments", () => ({ createManagedApp }));
vi.mock("@/engine/security/security-interfaces", async importOriginal => ({
  ...await importOriginal<typeof import("@/engine/security/security-interfaces")>(),
  checkRateLimit: vi.fn(async () => ({ ok: true })),
}));
import { POST } from "@/app/api/engine/apps/from-template/route";
import { APP_TEMPLATES } from "@/engine/templates/app-templates";
import { AppSpecSchema } from "@/engine/app-spec/app-spec-schema";
const id = "a".repeat(24);
beforeEach(() => {
  for (const [key, value] of Object.entries({ DATABASE_URL: "postgresql://fixture@localhost/minintapp_test", REDIS_URL: "redis://localhost", WORKER_TOKEN: "fixture-worker-token", WORKER_AGENT_URLS: "http://worker:19090", RUNTIME_IMAGE: `ghcr.io/95lab/minintapp@sha256:${"a".repeat(64)}`, APPS_DOMAIN: "apps.example.test" })) vi.stubEnv(key, value);
  vi.stubEnv("PLATFORM_ROLE", "control");
  vi.stubEnv("APP_ORIGIN", "https://dashboard.example.test");
  createManagedApp.mockResolvedValue({ id, hostToken: "fixture-host-token", deployed: { expires_at: new Date(Date.now()+3600000) }, tenant: { cookieName: "__Host-minint_tenant", token: "fixture-tenant" } });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it.each(APP_TEMPLATES)("queues $id as a full independent engine app", async template => {
  const request = new Request("https://dashboard.example.test/api/engine/apps/from-template", { method: "POST", headers: { Origin: "https://dashboard.example.test", "Content-Type": "application/json", "Idempotency-Key": "one-creation" }, body: JSON.stringify({ templateId: template.id, locale: "vi", lifetime: "24h" }) });
  const response = await POST(request);
  expect(response.status).toBe(202);
  expect(await response.json()).toMatchObject({ ok: true, id, deploymentState: "QUEUED" });
  expect(createManagedApp).toHaveBeenCalledExactlyOnceWith(request, expect.objectContaining({ engine: true, spec: AppSpecSchema.parse(template.spec.vi), lifetime: "24h" }));
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  expect(response.headers.get("set-cookie")).not.toContain("Domain=");
});
it("does not create another app inside an existing app's runtime", async () => {
  vi.stubEnv("PLATFORM_ROLE", "runtime");
  vi.stubEnv("RUNTIME_APP_ID", id); vi.stubEnv("RUNTIME_TOKEN", "fixture-runtime-token"); vi.stubEnv("RUNTIME_SEED", "fixture-seed");
  const response = await POST(new Request("https://dashboard.example.test/api/engine/apps/from-template", { method: "POST", headers: { Origin: "https://dashboard.example.test" } }));
  expect(response.status).toBe(403); expect(createManagedApp).not.toHaveBeenCalled();
});
