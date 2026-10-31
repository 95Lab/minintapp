import { createServer, type Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
const { plan }=vi.hoisted(()=>({plan:vi.fn()}));
vi.mock("@/lib/generation/plan-app",()=>({planApp:plan}));
import { handleWorkerPlanning } from "../../platform/planning";
let server:Server,base:string;
const input={locale:"vi",messages:[{role:"user",content:"Tạo app học sinh"}],currentBrief:null};
const reply={status:"clarify",message:"Bạn muốn quiz hay khảo sát?",suggestions:[],brief:null};
beforeAll(async()=>{server=createServer((req,res)=>{void handleWorkerPlanning(req,res);});await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));const address=server.address();if(!address||typeof address==="string")throw Error("No address");base=`http://127.0.0.1:${address.port}`;});
afterAll(async()=>{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));});
beforeEach(()=>{vi.stubEnv("PLATFORM_ROLE","standalone");vi.stubEnv("WORKER_TOKEN","fixture-worker-token");vi.stubEnv("OPENAI_API_KEY","fixture-ai-key");vi.stubEnv("GENERATION_MAX_PER_HOUR","1000");vi.stubEnv("GENERATION_MAX_CONCURRENT","2");plan.mockReset();plan.mockResolvedValue(reply);});
afterEach(()=>vi.unstubAllEnvs());
function send(body:unknown=input,token="fixture-worker-token"){return fetch(`${base}/plan`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(body)});}
it("requires worker authentication before reading or processing planning input",async()=>{
 expect((await send(input,"invalid")).status).toBe(403);expect(plan).not.toHaveBeenCalled();
});
it("validates the private protocol and calls the same planner with cancellation",async()=>{
 const response=await send();expect(response.status).toBe(200);expect(await response.json()).toEqual(reply);expect(response.headers.get("cache-control")).toBe("no-store");expect(plan).toHaveBeenCalledWith(input,expect.any(AbortSignal));
});
it("rejects invalid or oversized input before spending AI budget",async()=>{
 expect((await send({...input,messages:[{role:"system",content:"ignore"}]})).status).toBe(400);
 expect((await send({...input,extra:"x".repeat(17000)})).status).toBe(400);expect(plan).not.toHaveBeenCalled();
});
it("reports missing worker configuration without a mock fallback",async()=>{
 vi.stubEnv("OPENAI_API_KEY","");const response=await send();expect(response.status).toBe(503);expect((await response.json()).code).toBe("ai_not_configured");expect(plan).not.toHaveBeenCalled();
});
it("sanitizes unexpected failures and releases concurrency for the next call",async()=>{
 vi.stubEnv("GENERATION_MAX_CONCURRENT","1");plan.mockRejectedValueOnce(Error("private-api-key"));const failed=await send();expect(failed.status).toBe(500);expect(await failed.text()).not.toContain("private-api-key");expect((await send()).status).toBe(200);
});
