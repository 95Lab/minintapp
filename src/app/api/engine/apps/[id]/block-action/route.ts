import {randomInt} from "node:crypto";
import {appsRepository as base} from "@/lib/db/apps-repository";
import {BlockActionRequestSchema,parseBody} from "@/engine/api/request-schemas";
import {blockDefinition} from "@/engine/blocks/block-registry";
import {isHostRequest,jsonError,loadAppState} from "@/engine/api/route-helpers";
import {isUsable,type AppRecord,type ResponseRecord} from "@/engine/db/apps-repository-types";
import {secureRoute} from "@/engine/api/secure-route";
export function POST(req:Request,ctx:{params:Promise<{id:string}>}){return secureRoute(req,async()=>{
 const{id}=await ctx.params;const body=await parseBody(req,BlockActionRequestSchema);if(!body)return jsonError(400,"bad_action");
 const outcome=await base.mutateSnapshot(id,(snapshot,now)=>{
  const app=snapshot.app as unknown as AppRecord;
  const reject=(status:number,code:Parameters<typeof jsonError>[1])=>({value:{status,code},changed:false});
  if(!isUsable(app))return reject(410,"app_ended_or_moved");
  if(!isHostRequest(req,app))return reject(403,"host_only");
  if(app.status!=="active"&&!(app.status==="closed"&&body.action==="confirm_paid"))return reject(409,"app_closed");
  const block=app.spec.blocks.find(b=>b.id===body.blockId);if(!block)return reject(400,"unknown_block");
  const actions=blockDefinition(block.type).hostActions;const action=actions&&Object.hasOwn(actions,body.action)?actions[body.action]:null;if(!action)return reject(400,"bad_action");
  const answers=(snapshot.responses as unknown as ResponseRecord[]).filter(r=>r.blockId===block.id);
  const result=action(block,app.runtime,{args:body.args??{},random:()=>randomInt(0,2**32)/2**32,answers,now});
  if(!result.ok)return reject(400,result.error);
  app.runtime=result.runtime;return{value:{status:200,code:"unknown" as const},changed:true};
 });
 if(!outcome)return jsonError(404,"unknown_block");if(outcome.status!==200)return jsonError(outcome.status,outcome.code);
 return Response.json(await loadAppState(id,req));
});}
