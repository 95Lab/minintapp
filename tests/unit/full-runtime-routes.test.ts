import {beforeEach,describe,expect,it,vi} from "vitest";
import {POST as create} from "@/app/api/engine/apps/from-template/route";
import {GET as state} from "@/app/api/engine/apps/[id]/state/route";
import {POST as submit} from "@/app/api/engine/apps/[id]/responses/route";
import {POST as lifecycle} from "@/app/api/engine/apps/[id]/lifecycle/route";
import {POST as action} from "@/app/api/engine/apps/[id]/block-action/route";
import {POST as remix} from "@/app/api/engine/apps/[id]/remix/route";
import {GET as exportCsv} from "@/app/api/engine/apps/[id]/export/route";
import {POST as report} from "@/app/api/engine/apps/[id]/report/route";
import {POST as session} from "@/app/api/engine/auth/session/route";
import {POST as claim} from "@/app/api/engine/account/claim/route";
import {GET as account} from "@/app/api/engine/account/route";
import {appsRepository,resetMemoryStore} from "@/engine/db/apps-repository";
import {resetRateLimitMemoryStoreForTests} from "@/engine/security/rate-limit-memory-store";
import {findTemplate} from "@/engine/templates/app-templates";
import {AppSpecSchema} from "@/engine/app-spec/app-spec-schema";
import {photoUrl} from "@/engine/security/photo-url-signing";
import {POST as uploadPhoto} from "@/app/api/engine/apps/[id]/photos/route";
import {GET as getPhoto} from "@/app/api/engine/apps/[id]/photos/[photoId]/route";
vi.mock("@/engine/config/runtime-config",()=>({runtimeConfig:{supabaseUrl:"",supabaseServiceRoleKey:"unit-signing-key",supabaseAnonKey:"",openaiApiKey:"",openaiModel:"test",presenterKey:"",ipHashSalt:"unit",simulateEnabled:false},storageMode:()=>"memory",accountsEnabled:()=>true}));
vi.mock("@/engine/auth/supabase-auth-clients",()=>({sendMagicLink:vi.fn(async()=>({error:null})),userFromAccessToken:vi.fn(async()=>({userId:"11111111-1111-4111-8111-111111111111",email:"host@example.test"}))}));
vi.mock("@/engine/generation/generate-app-spec",()=>({GENERATION_DEADLINE_MS:18000,remixAppSpec:vi.fn(),generateAppSpec:vi.fn()}));
vi.mock("@/engine/security/moderate-prompt-openai",()=>({moderatePrompt:vi.fn(async()=>({ok:true}))}));
const ctx=(id:string)=>({params:Promise.resolve({id})});
const req=(body?:unknown,headers:Record<string,string>={})=>new Request("http://local/api",{method:body===undefined?"GET":"POST",headers:{"Content-Type":"application/json",...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
async function room(templateId="signup-slots"){const r=await create(req({templateId,locale:"vi",lifetime:"1h"}));expect(r.status).toBe(201);const b=await r.json();return{...b,headers:{cookie:r.headers.get("set-cookie")!.split(";")[0],"x-host-session":"1"}} as {id:string;hostToken:string;headers:Record<string,string>};}
beforeEach(()=>{resetMemoryStore();resetRateLimitMemoryStoreForTests();});
describe("complete runtime API boundaries",()=>{
 it("sets an HttpOnly host cookie and keeps participant state separate even in the host browser",async()=>{
  const r=await room("quick-quiz");
  const host=await(await state(req(undefined,r.headers),ctx(r.id))).json();expect(host.isHost).toBe(true);
  const player=await(await state(req(undefined,{cookie:r.headers.cookie}),ctx(r.id))).json();expect(player.isHost).toBe(false);
  expect(player.spec.blocks[0].questions.every((q:{correct:unknown})=>q.correct===null)).toBe(true);
  const denied=await action(req({blockId:host.spec.blocks[0].id,action:"open",args:{questionId:"q1"}},{cookie:r.headers.cookie}),ctx(r.id));expect(denied.status).toBe(403);
 });
 it("accepts overflow into a waitlist, exports safely, announces, extends and ends",async()=>{
  const r=await room();const app=(await appsRepository().findApp(r.id))!;const block=app.spec.blocks[0];if(block.type!=="compose")throw Error();
  const input=block.inputs[0];input.capacity=1;
  // Create a separate spec with a single seat to exercise overflow and viewer-specific results.
  const made=await appsRepository().createApp({spec:app.spec,prompt:"",lifetimeMs:3600000});
  for(const [who,name] of [["one","=SUM(A1)"] ,["two","Lan"]]){
   const res=await submit(req({blockId:block.id,itemId:"",participantToken:who.padEnd(24,"x"),displayName:name,payload:{kind:"compose",values:{[input.id]:input.options![0].id}}}),ctx(made.app.id));expect(res.status).toBe(200);
  }
  const hostHeaders={"x-host-token":made.hostToken};
  const results=await(await state(req(undefined,hostHeaders),ctx(made.app.id))).json();expect(results.results[0].views.some((v:{kind:string;groups?:Array<{waitlist:string[]}>})=>v.kind==="groups"&&v.groups?.some(g=>g.waitlist.length===1))).toBe(true);
  const csv=await exportCsv(req(undefined,hostHeaders),ctx(made.app.id));expect(csv.status).toBe(200);expect(await csv.text()).toContain("'=SUM(A1)");
  expect((await lifecycle(req({action:"announce",text:"Bắt đầu nhé"},hostHeaders),ctx(made.app.id))).status).toBe(200);
  expect((await lifecycle(req({action:"extend",by:"24h"},hostHeaders),ctx(made.app.id))).status).toBe(200);
  expect((await lifecycle(req({action:"end"},hostHeaders),ctx(made.app.id))).status).toBe(200);expect(await appsRepository().listResponses(made.app.id)).toHaveLength(0);
 });
 it("rebases concurrent next-step actions and enforces host authorization",async()=>{
  const r=await room("step-survey");const app=(await appsRepository().findApp(r.id))!;const block=app.spec.blocks[0];
  await Promise.all([action(req({blockId:block.id,action:"next"},r.headers),ctx(r.id)),action(req({blockId:block.id,action:"next"},r.headers),ctx(r.id))]);
  const fresh=(await appsRepository().findApp(r.id))!;const step=(fresh.runtime.blocks?.[block.id] as {step:{done:string[];current:string}}).step;
  expect(step.done).toHaveLength(1);expect(step.current).not.toBe(step.done[0]);
 });
 it("remixes through the real route, carries results into generation and moves the parent",async()=>{
  const r=await room("workshop-vote");const generation=await import("@/engine/generation/generate-app-spec");
  vi.mocked(generation.remixAppSpec).mockResolvedValue({outcome:"ok",spec:AppSpecSchema.parse(findTemplate("quick-quiz")!.spec.vi),suggestion:null,riskFlags:["none"]});
  const response=await remix(req({instruction:"Đổi thành quiz"},r.headers),ctx(r.id));expect(response.status).toBe(200);const child=await response.json();
  expect(child.newId).not.toBe(r.id);expect((await appsRepository().findApp(r.id))?.movedTo).toBe(child.newId);expect((await appsRepository().findApp(child.newId))?.parentId).toBe(r.id);
  expect(generation.remixAppSpec).toHaveBeenCalledWith(expect.anything(),expect.any(String),"Đổi thành quiz",expect.anything());expect(response.headers.get("set-cookie")).toContain("HttpOnly");
 });
 it("verifies an auth token, claims only controlled apps and lists the owner's rooms",async()=>{
  const r=await room("quick-quiz");const signed=await session(req({accessToken:"verified-token".repeat(3)}));expect(signed.status).toBe(200);
  const cookie=`${r.headers.cookie}; ${signed.headers.get("set-cookie")!.split(";")[0]}`;
  const claimed=await claim(req({apps:[{id:r.id,hostToken:""}]},{cookie}));expect(claimed.status).toBe(200);expect((await claimed.json()).claimed).toContain(r.id);
  const list=await account(req(undefined,{cookie}));expect((await list.json()).apps.map((a:{id:string})=>a.id)).toContain(r.id);
 });
 it("requires distinct networks for reports and blocks cross-origin cookie mutations",async()=>{
  const r=await room("quick-quiz");
  const rejected=await lifecycle(req({action:"end"},{...r.headers,origin:"http://evil.test"}),ctx(r.id));expect(rejected.status).toBe(403);
  for(let i=0;i<3;i++)expect((await report(req({}, {"x-participant-token":String(i).padEnd(24,"x"),"x-forwarded-for":`192.0.2.${i+1}`}),ctx(r.id))).status).toBe(200);
  expect((await appsRepository().findApp(r.id))?.status).toBe("blocked");
 });
 it("stores an image, serves only signed URLs and removes it when the room ends",async()=>{
  const r=await room("photo-contest");const app=(await appsRepository().findApp(r.id))!;const b=app.spec.blocks[0];
  const bytes=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);
  const uploaded=await uploadPhoto(new Request(`http://local/photos?block=${b.id}`,{method:"POST",headers:{"x-participant-token":"a".repeat(24)},body:bytes}),ctx(r.id));expect(uploaded.status).toBe(200);const{photoId}=await uploaded.json();
  const photoContext={params:Promise.resolve({id:r.id,photoId})};expect((await getPhoto(new Request("http://local/photos"),photoContext)).status).toBe(404);
  const url=photoUrl(r.id,photoId);expect((await getPhoto(new Request(`http://local${url}`),photoContext)).status).toBe(200);
  await lifecycle(req({action:"end"},r.headers),ctx(r.id));expect((await getPhoto(new Request(`http://local${url}`),photoContext)).status).toBe(404);
 });
});
