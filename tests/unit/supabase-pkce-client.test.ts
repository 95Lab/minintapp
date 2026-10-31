import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/engine/config/runtime-config",()=>({runtimeConfig:{supabaseUrl:"https://auth.example.test",supabaseAnonKey:"sb_publishable_fixture"}}));
import { sendMagicLink, userFromAuthCode } from "@/engine/auth/supabase-auth-clients";
afterEach(()=>vi.unstubAllGlobals());
it("uses the real SDK PKCE challenge/verifier with request-scoped storage and public credentials",async()=>{
 let challenge="",verifier="",redirect="";
 vi.stubGlobal("fetch",vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(String(input)),body=JSON.parse(String(init?.body));
  if(url.pathname.endsWith("/otp")){challenge=body.code_challenge;redirect=url.searchParams.get("redirect_to")!;expect(body.create_user).toBe(true);return Response.json({});}
  if(url.pathname.endsWith("/token")){verifier=body.code_verifier;return Response.json({access_token:"fixture-access-token",refresh_token:"fixture-refresh-token",expires_in:3600,token_type:"bearer",user:{id:"11111111-1111-4111-8111-111111111111",email:"user@example.test",email_confirmed_at:new Date().toISOString()}});}
  throw Error("Unexpected Auth request");
 }));
 const sent=await sendMagicLink("user@example.test","https://app.example.test/auth/callback");
 expect(sent.error).toBeNull();expect(challenge.length).toBeGreaterThan(30);
 const flowId=new URL(redirect).searchParams.get("sb_flow_id")!;
 expect(await userFromAuthCode("test-code",sent.storage,flowId)).toMatchObject({email:"user@example.test"});
 expect(createHash("sha256").update(verifier).digest("base64url")).toBe(challenge);
});
