import "server-only";
import { appsRepository as base } from "@/lib/db/apps-repository";
import type {AppSnapshot,AppRecord as LegacyApp} from "@/lib/db/apps-repository-types";
import { applyRuntimePatch } from "./runtime-patch";
import { isUsable,type AppRecord,type AppsRepository,type ResponseRecord } from "./apps-repository-types";
import { validateResponsePayload } from "@/engine/responses/validate-response-payload";
import { AppError } from "@/lib/api/app-error-codes";
import { supabaseServer } from "./supabase-server-client";
import { storageMode } from "@/engine/config/runtime-config";
export * from "./apps-repository-types";
// Keep the app-scoped identity stable for rooms created before the port.
export { participantHashFor } from "@/lib/security/token-hashing";
const record=(app:LegacyApp):AppRecord=>({...app,payee:null,reportCount:0,...app} as unknown as AppRecord);
const edit=<T>(id:string,fn:(app:AppRecord,snapshot:AppSnapshot,now:number)=>{value:T;changed:boolean})=>base.mutateSnapshot(id,(s,now)=>fn(s.app as unknown as AppRecord,s,now));
const changed=<T>(value:T)=>({value,changed:true}),unchanged=<T>(value:T)=>({value,changed:false});
const repo:AppsRepository={
 async createApp(input){const r=await base.createApp(input as unknown as Parameters<typeof base.createApp>[0]);return{app:record(r.app),hostToken:r.hostToken};},
 async findApp(id){const app=await base.findApp(id);return app?record(app):null;},
 async listResponses(id){return await base.listResponses(id) as unknown as ResponseRecord[];},
 async setOwner(id,userId){return await edit(id,(app)=>{if(app.ownerId)return unchanged(false);app.ownerId=userId;return changed(true);})??false;},
 async listAppsByOwner(userId){return(await base.listAppsByOwner(userId)).map(record);},
 async submitResponse(id,r,opts={}){
  return await edit(id,(app,s,now)=>{
   if(!isUsable(app))return unchanged("gone" as const);
   if(app.status!=="active"&&!(app.status==="closed"&&r.itemId==="_paid"))return unchanged("closed" as const);
   const error=validateResponsePayload(app,{...r,participantToken:"internal-validation"});if(error)throw new AppError(error==="question_closed"?error:"invalid_request");
   const rows=s.responses as unknown as ResponseRecord[];const index=rows.findIndex(x=>x.blockId===r.blockId&&x.itemId===r.itemId&&x.participantHash===r.participantHash);
   if(opts.remove){if(index>=0)rows.splice(index,1);return changed("ok" as const);}
   if(index<0&&rows.length>=1000)return unchanged("limit" as const);
   if(index<0&&opts.maxRowsPerParticipant!==undefined&&!r.itemId.startsWith("_")){
    const like=r.itemId.startsWith("l-");const count=rows.filter(x=>x.blockId===r.blockId&&x.participantHash===r.participantHash&&!x.itemId.startsWith("_")&&x.itemId.startsWith("l-")===like).length;
    if(count>=opts.maxRowsPerParticipant)return unchanged("limit" as const);
   }
   const row={...r,payload:r.payload.kind==="custom"?{...r.payload,at:now}:r.payload,createdAt:index<0?now:rows[index].createdAt};
   if(index<0)rows.push(row);else rows[index]=row;return changed("ok" as const);
  })??"gone";
 },
 async patchRuntime(id,patch){await edit(id,(app)=>{if(!isUsable(app))return unchanged(undefined);app.runtime=applyRuntimePatch(app.runtime,patch);return changed(undefined);});},
 async updateApp(id,patch){await edit(id,app=>{if(!isUsable(app))return unchanged(undefined);Object.assign(app,patch);return changed(undefined);});},
 async markMoved(id,toId){return await edit(id,app=>{if(!isUsable(app)||app.status!=="active"||app.movedTo)return unchanged(false);app.movedTo=toId;app.status="closed";return changed(true);})??false;},
 async extendApp(id,until){return await edit(id,app=>{if(!isUsable(app)||until<=app.expiresAt)return unchanged(false);app.expiresAt=until;return changed(true);})??false;},
 async setAnnouncement(id,value){return await edit(id,app=>{if(!isUsable(app))return unchanged(false);app.announcement=value;return changed(true);})??false;},
 async setPayee(id,value){return await edit(id,app=>{if(!isUsable(app))return unchanged(false);app.payee=value;return changed(true);})??false;},
 async endApp(id){const before=await base.snapshot(id);await edit(id,(app,s,now)=>{if(!isUsable(app))return unchanged(undefined);app.payee=null;s.responses=[];s.extension={};app.runtime={openQuestionId:null,revealedQuestionIds:[],blocks:{}};app.status="ended";app.endedAt=now;return changed(undefined);});
  const paths=Object.values(before?.extension?.photos??{}).flatMap(p=>p.path?[p.path]:[]);if(paths.length&&storageMode()==="supabase")await supabaseServer().storage.from("minint-photos").remove(paths);
 },
 async addReport(id,reporter,ip,threshold){return await edit(id,(app,s)=>{s.extension??={};const reports=s.extension.reports??={};if(reports[reporter])return unchanged(new Set(Object.values(reports)).size);reports[reporter]=ip;app.reportCount=Object.keys(reports).length;const networks=new Set(Object.values(reports)).size;if(networks>=threshold)app.status="blocked";return changed(networks);})??0;},
 async addPhoto(id,photo,caps){
  let path:string|undefined;
  if(storageMode()==="supabase"){
   const storage=supabaseServer().storage;const bucket=await storage.getBucket("minint-photos");if(bucket.error){const created=await storage.createBucket("minint-photos",{public:false,fileSizeLimit:600000,allowedMimeTypes:["image/jpeg","image/png","image/webp"]});if(created.error&&!/exist/i.test(created.error.message))throw new AppError("storage_unavailable");}
   path=`${id}/${photo.id}`;const uploaded=await storage.from("minint-photos").upload(path,photo.bytes,{contentType:photo.mime,upsert:false});if(uploaded.error)throw new AppError("storage_unavailable");
  }
  let outcome;
  try{outcome=await edit(id,(app,s)=>{if(!isUsable(app))return unchanged("gone" as const);if(app.status!=="active")return unchanged("closed" as const);s.extension??={};const photos=s.extension.photos??={};if(Object.keys(photos).length>=caps.perApp||Object.values(photos).filter(p=>p.participantHash===photo.participantHash).length>=caps.perPerson)return unchanged("limit" as const);photos[photo.id]={participantHash:photo.participantHash,mime:photo.mime,...(path?{path}:{base64:Buffer.from(photo.bytes).toString("base64")})};return changed("ok" as const);})??"gone";}catch(error){if(path)await supabaseServer().storage.from("minint-photos").remove([path]);throw error;}
  if(outcome!=="ok"&&path)await supabaseServer().storage.from("minint-photos").remove([path]);return outcome;
 },
 async getPhoto(id,photoId){const s=await base.snapshot(id);if(!s||!isUsable(record(s.app)))return null;const photo=s.extension?.photos?.[photoId];if(!photo)return null;if(photo.base64)return{mime:photo.mime,bytes:new Uint8Array(Buffer.from(photo.base64,"base64"))};const r=await supabaseServer().storage.from("minint-photos").download(photo.path!);return r.error?null:{mime:photo.mime,bytes:new Uint8Array(await r.data.arrayBuffer())};},
};
export const appsRepository=()=>repo;
export {resetMemoryRepositoryForTests as resetMemoryStore} from "@/lib/db/apps-repository";
