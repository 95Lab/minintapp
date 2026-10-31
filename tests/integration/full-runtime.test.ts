import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/engine/db/supabase-server-client";
import { appsRepository } from "@/engine/db/apps-repository";
import { AppSpecSchema } from "@/engine/app-spec/app-spec-schema";
import { findTemplate } from "@/engine/templates/app-templates";
import { readRuntimeConfig } from "@/lib/config/runtime-config";

it("runs the new rate limiter and security log with service-only permissions", async()=>{
 const client=supabaseServer(),key=`integration-${randomUUID()}`;
 try {
  const hit=()=>client.rpc("minint_hit_rate_limit",{p_bucket:"integration",p_key:key,p_window_seconds:3600,p_max:2});
  const results=await Promise.all([hit(),hit(),hit()]);
  expect(results.map(r=>r.error)).toEqual([null,null,null]);
  expect(results.map(r=>r.data).sort()).toEqual([false,true,true]);
  const logged=await client.from("minint_security_events").insert({kind:"integration_check",detail:{note:"Synthetic verification; no user data"}});
  expect(logged.error).toBeNull();
  const env=readRuntimeConfig();
  const anon=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false},global:{fetch:async(input,init)=>{const headers=new Headers(init?.headers);if(headers.get("authorization")?.startsWith("Bearer sb_"))headers.delete("authorization");return fetch(input,{...init,headers,signal:AbortSignal.timeout(8000)});}}});
  const denied=await anon.rpc("minint_hit_rate_limit",{p_bucket:"integration",p_key:key,p_window_seconds:3600,p_max:2});
  expect(denied.error).not.toBeNull();
 }finally{await client.from("minint_rate_limits").delete().eq("bucket","integration").eq("key",key);}
});

it("persists full specs, owner claims and private photos, then removes room photos on end",async()=>{
 const repo=appsRepository(),owner=randomUUID();
 const {app}=await repo.createApp({spec:AppSpecSchema.parse(findTemplate("signup-slots")!.spec.vi),prompt:"Integration verification",lifetimeMs:3600000});
 const photoId=randomUUID();
 try {
  expect(await repo.setOwner(app.id,owner)).toBe(true);
  expect(await repo.setOwner(app.id,randomUUID())).toBe(false);
  expect((await repo.listAppsByOwner(owner)).map(a=>a.id)).toContain(app.id);
  const bytes=new Uint8Array([137,80,78,71,13,10,26,10]);
  expect(await repo.addPhoto(app.id,{id:photoId,participantHash:"integration-only",mime:"image/png",bytes},{perApp:3,perPerson:2})).toBe("ok");
  expect((await repo.getPhoto(app.id,photoId))?.bytes).toEqual(bytes);
  const bucket=await supabaseServer().storage.getBucket("minint-photos");
  expect(bucket.error).toBeNull();expect(bucket.data?.public).toBe(false);
 }finally{await repo.endApp(app.id);}
 expect(await repo.getPhoto(app.id,photoId)).toBeNull();
 const removed=await supabaseServer().storage.from("minint-photos").download(`${app.id}/${photoId}`);
 expect(removed.error).not.toBeNull();
});
