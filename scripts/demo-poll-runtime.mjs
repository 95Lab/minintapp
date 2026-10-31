import { randomBytes } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PollRuntimeManifestSchema } from "../.runtime-build/src/lib/blocks/poll-runtime-schema.js";
const root = new URL("../", import.meta.url), dir = new URL(".runtime-local/", root);
await mkdir(dir, { recursive: true, mode: 0o700 });
const manifestPath = new URL("manifest.json", dir), tokenPath = new URL("host-token", dir);
const manifest = PollRuntimeManifestSchema.parse({
  templateVersion:"poll-v1", appId:randomBytes(12).toString("hex"), deploymentId:randomBytes(12).toString("hex"), specHash:"0".repeat(64), hostname:"poll.runtime.example", expiresAt:Date.now()+86400000,
  locale:"vi",theme:"sunset",title:"Hôm nay uống gì?",description:"Bình chọn cùng cả nhóm.",blockTitle:"Chọn đồ uống",question:"Bạn chọn món nào?",note:null,resultsTitle:"Kết quả",requireName:false,options:[{id:"tea",label:"Trà"},{id:"coffee",label:"Cà phê"}],resultsVisibility:"everyone",
});
for (const [path, content, mode] of [[manifestPath,JSON.stringify(manifest,null,2),0o644],[tokenPath,randomBytes(32).toString("hex"),0o600]]) {
  try {await writeFile(path,content,{flag:"wx",mode});} catch(error) {if(error.code!=="EEXIST")throw error;}
}
const current=PollRuntimeManifestSchema.parse(JSON.parse(await readFile(manifestPath,"utf8")));
if(current.expiresAt<=Date.now())throw new Error("Local demo expired. Move .runtime-local aside to start a new demo; do not reuse its SQLite volume for another manifest.");
console.info("Local poll: http://127.0.0.1:3210/\nHost: http://127.0.0.1:3210/host\nHost key is in .runtime-local/host-token (not printed).");
const child=spawn(process.execPath,["--conditions=react-server",fileURLToPath(new URL(".runtime-build/runtime/poll/main.js",root))],{stdio:"inherit",env:{NODE_ENV:"development",PORT:"3210",POLL_LOCAL_ORIGIN:"http://127.0.0.1:3210",POLL_MANIFEST_FILE:fileURLToPath(manifestPath),POLL_HOST_TOKEN_FILE:fileURLToPath(tokenPath),POLL_DB_FILE:fileURLToPath(new URL("poll.sqlite",dir))}});
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>child.kill(signal));
child.on("error",()=>{console.error("Could not start local runtime");process.exitCode=1;});
child.on("exit",code=>{process.exitCode=code??1;});
