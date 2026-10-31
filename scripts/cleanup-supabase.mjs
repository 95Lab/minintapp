// Scheduled maintenance. Only removes photos belonging to ended/blocked rooms or rooms
// expired for at least ten minutes. The bucket is private; no credentials are printed.
import { createClient } from "@supabase/supabase-js";
import { EnvSchema } from "../src/lib/config/env-schema.ts";
const apply=process.argv.includes("--apply");
const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success || parsed.data.APP_STORAGE !== "supabase") {
  console.error("Configure a valid Supabase environment before running maintenance.");
  process.exitCode = 1;
} else {
  const env=parsed.data;
  const client=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{fetch:async(input,init)=>{
      const headers=new Headers(init?.headers);
      if(headers.get("authorization")?.startsWith("Bearer sb_"))headers.delete("authorization");
      return fetch(input,{...init,headers,signal:AbortSignal.timeout(10000)});
    }},
  });
  try {
    let removedPhotos=0;
    const bucket=client.storage.from("minint-photos");
    const exists=await client.storage.getBucket("minint-photos");
    if(exists.error && !/not found|does not exist/i.test(exists.error.message))throw Error();
    if(exists.data) {
      const folders=[];
      // Read before deleting so pagination cannot skip entries after removal.
      for(let offset=0;offset<2000;offset+=100){
        const page=await bucket.list("",{limit:100,offset,sortBy:{column:"name",order:"asc"}});
        if(page.error)throw Error();
        folders.push(...page.data.filter(f=>/^[a-f0-9]{24}$/.test(f.name)&&!f.id));
        if(page.data.length<100)break;
      }
      for(const folder of folders){
        const found=await client.from("minint_app_snapshots").select("document").eq("id",folder.name).maybeSingle();
        if(found.error)throw Error();
        const app=found.data?.document?.app;
        if(found.data&&!app)throw Error();
        if(app && !["ended","blocked"].includes(app.status) && !(Number(app.expiresAt)<Date.now()-600000))continue;
        const files=await bucket.list(folder.name,{limit:1000});
        if(files.error)throw Error();
        const paths=files.data.filter(f=>f.id).map(f=>`${folder.name}/${f.name}`);
        if(paths.length){if(apply){const result=await bucket.remove(paths);if(result.error)throw Error();}removedPhotos+=paths.length;}
      }
    }
    const cleanup=apply?await client.rpc("minint_cleanup"):{error:null,data:0};
    if(cleanup.error)throw Error();
    console.log(apply?`Maintenance complete: ${removedPhotos} photos and ${cleanup.data ?? 0} expired snapshots removed.`:`Dry run: ${removedPhotos} photos eligible; no data changed. Pass --apply to perform maintenance.`);
  }catch{console.error("Supabase maintenance failed; check connectivity, migrations and Storage permissions.");process.exitCode=1;}
}
