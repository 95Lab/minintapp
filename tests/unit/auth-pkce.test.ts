import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { send, exchange } = vi.hoisted(()=>({send:vi.fn(),exchange:vi.fn()}));
vi.mock("@/engine/config/runtime-config",()=>({accountsEnabled:()=>true,storageMode:()=>"memory",runtimeConfig:{ipHashSalt:"auth-unit-secret",supabaseServiceRoleKey:"",supabaseUrl:"",supabaseAnonKey:""}}));
vi.mock("@/engine/auth/supabase-auth-clients",()=>({sendMagicLink:send,userFromAuthCode:exchange}));
import { POST as requestLink } from "@/app/api/engine/auth/magic-link/route";
import { POST as session, GET, DELETE } from "@/app/api/engine/auth/session/route";
import { sealPkce, readPkce } from "@/engine/auth/pkce-cookie";
import { resetRateLimitMemoryStoreForTests } from "@/engine/security/rate-limit-memory-store";
const request=(body:unknown,cookie="")=>new Request("https://app.example.test/api/engine/auth/session",{method:"POST",headers:{"Content-Type":"application/json",Origin:"https://app.example.test",cookie},body:JSON.stringify(body)});
beforeEach(()=>{resetRateLimitMemoryStoreForTests();send.mockResolvedValue({error:null,storage:{verifier:"private-pkce-verifier"}});exchange.mockResolvedValue({userId:"11111111-1111-4111-8111-111111111111",email:"test@example.test"});});
afterEach(()=>vi.unstubAllEnvs());
it("sets a secure HttpOnly browser-bound state and uses the configured callback origin",async()=>{
 vi.stubEnv("APP_ORIGIN","https://app.example.test");
 const response=await requestLink(request({email:"test@example.test"}));
 expect(response.status).toBe(200);expect(send).toHaveBeenCalledWith("test@example.test","https://app.example.test/auth/callback");
 const cookie=response.headers.get("set-cookie")!;
 expect(cookie).toContain("__Host-minint_pkce=");expect(cookie).toContain("HttpOnly");expect(cookie).toContain("Secure");
 expect(await response.text()).not.toContain("verifier");
});
it("rejects missing/tampered/expired state and arbitrary access tokens before provider exchange",async()=>{
 for(const cookie of ["","__Host-minint_pkce=tampered",`__Host-minint_pkce=${sealPkce({verifier:"x"},Date.now()-3700000)}`])expect((await session(request({code:"valid-code"},cookie))).status).toBe(401);
 expect((await session(request({accessToken:"valid-access-token"}))).status).toBe(400);
 expect(exchange).not.toHaveBeenCalled();
});
it("exchanges a code, clears pending state, creates a host-only session, and signs out",async()=>{
 const cookie=`__Host-minint_pkce=${sealPkce({verifier:"x"})}`;
 const signed=await session(request({code:"valid-code"},cookie));expect(signed.status).toBe(200);
 const cookies=signed.headers.get("set-cookie")!;expect(cookies).toContain("__Host-minint_session=");expect(cookies).toContain("Max-Age=0");
 const value=cookies.match(/__Host-minint_session=[^; ,]+/)![0];
 const req=new Request("https://app.example.test/api/engine/auth/session",{headers:{cookie:value}});
 expect(await(await GET(req)).json()).toMatchObject({user:{email:"test@example.test"},accountsEnabled:true});
 const signedOut=await DELETE(new Request(req,{method:"DELETE"}));
 expect(signedOut.headers.get("set-cookie")).toContain("Max-Age=0");
 expect(signedOut.headers.get("set-cookie")).toContain("__Host-minint_pkce=");
 expect(signedOut.headers.get("set-cookie")).toContain("__Host-minint_session=");
 expect(signedOut.headers.get("cache-control")).toBe("no-store");
 expect(readPkce(request({},cookie))).toEqual({verifier:"x"});
});
it("reports delivery failures without logging provider details or claiming email was sent",async()=>{
 send.mockResolvedValue({error:"provider-error",storage:{}});
 expect((await requestLink(request({email:"test@example.test"}))).status).toBe(503);
});
