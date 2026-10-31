import { beforeEach, afterEach, expect, it, vi } from "vitest";
const { query, release } = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn() }));
vi.mock("../../platform/store", () => ({ pool: { connect: async () => ({ query, release }) }, deployment: vi.fn() }));
import { submitDeployment } from "@/lib/control-plane/deployments";
import { secureRoute } from "@/engine/api/secure-route";
import { errorText } from "@/engine/api/app-error-codes";

beforeEach(() => {
  vi.stubEnv("RUNTIME_IMAGE", `ghcr.io/95lab/minintapp@sha256:${"a".repeat(64)}`);
  vi.stubEnv("APPS_DOMAIN", "apps.example.test");
  vi.stubEnv("MAX_ACTIVE_APPS", "100");
  vi.stubEnv("MAX_CREATIONS_PER_HOUR", "30");
});
afterEach(() => vi.unstubAllEnvs());

it.each([
  { recent: 30, total: 0, owned: 0, code: "creation_hourly_limit", status: 429 },
  { recent: 2, total: 100, owned: 0, code: "app_capacity_full", status: 503 },
  { recent: 2, total: 50, owned: 50, code: "owner_app_limit", status: 409 },
])("reports $code through the creation route wrapper", async ({ recent, total, owned, code, status }) => {
  query.mockReset(); release.mockClear();
  query.mockImplementation(async (sql: string) => {
    if (sql.includes("created_at>")) return { rows: [{ count: String(recent) }] };
    if (sql.includes("owner_id=$1")) return { rows: [{ count: String(owned) }] };
    return { rows: [{ count: String(total) }] };
  });
  const response = await secureRoute(new Request("http://local", { method: "POST" }), async () => {
    await submitDeployment({ prompt: "vote", lifetime: "1h" }, "owner");
    return Response.json({ ok: true });
  });
  expect(response.status).toBe(status);
  const body = await response.json();
  expect(body.code).toBe(code);
  expect(body.message).not.toMatch(/Chậm lại|thao tác quá nhanh/);
  expect(errorText(code, "vi")).toBe(body.message);
  expect(query).toHaveBeenCalledWith("ROLLBACK");
  expect(query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(false);
  expect(release).toHaveBeenCalledOnce();
});
