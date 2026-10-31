import { beforeEach, afterEach, expect, it, vi } from "vitest";
const { query, limit } = vi.hoisted(() => ({ query:vi.fn(),limit:vi.fn() }));
vi.mock("../../platform/store",()=>({pool:{query}}));
vi.mock("@/engine/security/check-rate-limit",()=>({checkRateLimit:limit}));
import { POST } from "@/app/api/engine/plan/route";
const input={locale:"vi",messages:[{role:"user",content:"Tạo app học sinh"}],currentBrief:null};
const reply={status:"clarify",message:"Bạn muốn làm quiz hay khảo sát?",suggestions:["Làm quiz"],brief:null};
const request=(body:unknown=input)=>new Request("http://local/api/engine/plan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
const image=`ghcr.io/95lab/minintapp@sha256:${"1".repeat(64)}`;
beforeEach(()=>{
 for(const [key,value] of Object.entries({PLATFORM_ROLE:"control",APP_ORIGIN:"http://local",APP_STORAGE:"memory",DATABASE_URL:"postgresql://fixture@localhost/test",REDIS_URL:"redis://localhost",WORKER_TOKEN:"fixture-private-worker-token",WORKER_AGENT_URLS:" http://worker:19090 ",RUNTIME_IMAGE:image,APPS_DOMAIN:"apps.example.test",OPENAI_API_KEY:"",GENERATION_MAX_PER_HOUR:"1000",GENERATION_MAX_CONCURRENT:"2"}))vi.stubEnv(key,value);
 query.mockResolvedValue({rows:[{agent_url:"http://untrusted:19090"},{agent_url:"http://worker:19090"}]});limit.mockResolvedValue({ok:true});
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks();});
it("plans on the approved worker when the web server has no OpenAI key",async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json(reply));vi.stubGlobal("fetch",fetcher);
 const response=await POST(request());expect(response.status).toBe(200);expect(await response.json()).toEqual(reply);
 expect(response.headers.get("set-cookie")).toBeNull();expect(response.headers.get("cache-control")).toBe("no-store");
 expect(fetcher).toHaveBeenCalledExactlyOnceWith("http://worker:19090/plan",expect.objectContaining({method:"POST",redirect:"error",headers:{"Content-Type":"application/json",Authorization:"Bearer fixture-private-worker-token"},body:JSON.stringify(input)}));
 expect(query).toHaveBeenCalledWith(expect.stringContaining("heartbeat_at"),[image]);
});
it("does not contact workers outside the allowlist or fall back to the web key",async()=>{
 vi.stubEnv("OPENAI_API_KEY","fixture-web-key-unused");query.mockResolvedValue({rows:[{agent_url:"http://untrusted:19090"}]});
 const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
 const response=await POST(request());expect(response.status).toBe(503);expect((await response.json()).code).toBe("runtime_unavailable");expect(fetcher).not.toHaveBeenCalled();
});
it.each(["ai_not_configured","rate_limited","ai_timeout"])("preserves safe worker error code %s without exposing its message",async code=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({code,message:"secret-provider-detail"},{status:503}));vi.stubGlobal("fetch",fetcher);
 const response=await POST(request());const body=await response.json();expect(body.code).toBe(code);expect(body.message).not.toContain("secret-provider-detail");expect(fetcher).toHaveBeenCalledOnce();
});
it("rejects invalid worker output and does not retry a paid request",async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({...reply,status:"ready"}));vi.stubGlobal("fetch",fetcher);
 const response=await POST(request());expect((await response.json()).code).toBe("ai_invalid_output");expect(fetcher).toHaveBeenCalledOnce();
});
it("checks input and public rate limits before contacting the worker",async()=>{
 const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
 expect((await POST(request({...input,messages:[]}))).status).toBe(400);
 limit.mockResolvedValue({ok:false});expect((await POST(request())).status).toBe(429);expect(fetcher).not.toHaveBeenCalled();
});
