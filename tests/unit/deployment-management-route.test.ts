import { afterEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const { deployment, query, history, images, logs, manage } = vi.hoisted(() => ({ deployment: vi.fn(), query: vi.fn(), history: vi.fn(), images: vi.fn(), logs: vi.fn(), manage: vi.fn() }));
vi.mock("../../platform/store", () => ({ deployment, pool: { query } }));
vi.mock("../../platform/release-store", () => ({ releaseHistory: history, approvedImages: images, manageDeployment: manage }));
vi.mock("../../platform/logs", () => ({ storedLogs: logs }));
import { GET, POST } from "@/app/api/apps/[id]/deployment/route";
const id = "a".repeat(24), token = "host-capability-for-route-test";
const image = `ghcr.io/95lab/minintapp@sha256:${"1".repeat(64)}`;
const context = { params: Promise.resolve({ id }) };
function setup() {
  for (const [key,value] of Object.entries({DATABASE_URL:"postgresql://fixture@localhost/minintapp_test",REDIS_URL:"redis://localhost",RUNTIME_IMAGE:image,APPS_DOMAIN:"apps.example.test"})) vi.stubEnv(key,value);
  vi.stubEnv("PLATFORM_ROLE","control"); vi.stubEnv("APP_ORIGIN","http://localhost");
  vi.stubEnv("WORKER_AGENT_URLS","http://worker:19090"); vi.stubEnv("WORKER_TOKEN","private-worker-capability");
  deployment.mockResolvedValue({id,owner_id:"owner",host_token_hash:createHash("sha256").update(token).digest("hex"), state:"RUNNING",active_version:1,requested_version:null,worker_id:"worker", seed:{hostTokenHash:"secret",spec:{answer:"private"}}});
  history.mockResolvedValue([{version:1,image,specDigest:"digest",status:"SUCCEEDED",previousVersion:null,rollbackOf:null,createdAt:new Date().toISOString(),completedAt:null}]);
  images.mockResolvedValue([image,"untrusted:latest"]); logs.mockResolvedValue([{id:"1",at:new Date().toISOString(),source:"deployment",message:"state: RUNNING"}]);
  query.mockResolvedValue({ rows:[{agent_url:"http://worker:19090"}] }); manage.mockResolvedValue(undefined);
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
it("denies participants access to logs and release metadata", async () => {
  setup(); const response = await GET(new Request(`http://localhost/api/apps/${id}/deployment?details=1`),context);
  expect(response.status).toBe(403); expect(history).not.toHaveBeenCalled(); expect(logs).not.toHaveBeenCalled();
});
it("returns only owner projections and calls only an allowlisted worker with internal authentication", async () => {
  setup(); const fetcher = vi.fn().mockResolvedValue(Response.json([{id:"live",at:new Date().toISOString(),source:"runtime",message:"started"}])); vi.stubGlobal("fetch",fetcher);
  const response = await GET(new Request(`http://localhost/api/apps/${id}/deployment?details=1`,{headers:{"x-host-token":token}}),context);
  expect(response.status).toBe(200); const body = await response.json(); expect(body).toMatchObject({activeVersion:1,runtimeLogsAvailable:true,images:[image]});
  expect(body.logs).toHaveLength(2); const json = JSON.stringify(body); expect(json).not.toContain("hostTokenHash"); expect(json).not.toContain("private-worker-capability"); expect(json).not.toContain('"seed"');
  expect(fetcher).toHaveBeenCalledWith(`http://worker:19090/logs/${id}`,expect.objectContaining({redirect:"error",headers:{Authorization:"Bearer private-worker-capability"}}));
});
it("keeps archived logs available without contacting a worker outside the allowlist", async () => {
  setup(); query.mockResolvedValue({rows:[{agent_url:"http://untrusted:19090"}]}); const fetcher = vi.fn();vi.stubGlobal("fetch",fetcher);
  const response = await GET(new Request(`http://localhost/api/apps/${id}/deployment?details=1`,{headers:{"x-host-token":token}}),context);
  expect(await response.json()).toMatchObject({runtimeLogsAvailable:false}); expect(fetcher).not.toHaveBeenCalled();
});
it("validates rollback and origin before enqueuing a release", async () => {
  setup();
  const send = (body:unknown,origin="http://localhost") => POST(new Request(`http://localhost/api/apps/${id}/deployment`,{method:"POST",headers:{origin,"x-host-token":token,"Content-Type":"application/json"},body:JSON.stringify(body)}),context);
  expect((await send({action:"rollback",version:1})).status).toBe(400);
  expect((await send({action:"rollback",version:1,expectedVersion:2},"http://evil.test")).status).toBe(403);
  expect(manage).not.toHaveBeenCalled();
  expect((await send({action:"rollback",version:1,expectedVersion:2})).status).toBe(200);
  expect(manage).toHaveBeenCalledWith(id,{action:"rollback",version:1,expectedVersion:2});
});
