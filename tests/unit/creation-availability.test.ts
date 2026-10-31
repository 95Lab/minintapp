import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { count, session, tenant } = vi.hoisted(() => ({ count: vi.fn(), session: vi.fn(), tenant: vi.fn() }));
vi.mock("../../platform/store", () => ({ countOwnedDeployments: count }));
vi.mock("@/engine/auth/host-session", () => ({ readSession: session }));
vi.mock("@/lib/control-plane/deployments", () => ({ tenantIdentity: tenant }));
import { GET } from "@/app/api/creation-availability/route";
import { CreationAvailabilitySchema, creationBlocked } from "@/lib/api/creation-availability";
const request = () => new Request("http://local/api/creation-availability");
beforeEach(() => {
  vi.stubEnv("PLATFORM_ROLE", "control");
  session.mockReturnValue(null); tenant.mockReturnValue({ id: "browser-owner" }); count.mockResolvedValue(2);
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it("reports browser quota without caching or exposing identity", async () => {
  const response = await GET(request());
  expect(response.headers.get("cache-control")).toBe("no-store");
  const body = await response.json();
  expect(body).toEqual({ used: 2, limit: 2 });
  expect(creationBlocked(CreationAvailabilitySchema.parse(body))).toBe(true);
  expect(count).toHaveBeenCalledWith("browser-owner");
});
it("checks the signed-in creation owner rather than combining browser and account apps", async () => {
  session.mockReturnValue({ userId: "account-owner" }); count.mockResolvedValue(1);
  expect(await (await GET(request())).json()).toEqual({ used: 1, limit: 2 });
  expect(count).toHaveBeenCalledWith("account-owner");
});
it("leaves standalone creation unrestricted without querying the platform database", async () => {
  vi.stubEnv("PLATFORM_ROLE", "");
  expect(await (await GET(request())).json()).toEqual({ used: 0, limit: null });
  expect(count).not.toHaveBeenCalled();
});
it("does not pretend a database error means free capacity", async () => {
  count.mockRejectedValue(new Error("private database detail"));
  const response = await GET(request());
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("private database detail");
});
