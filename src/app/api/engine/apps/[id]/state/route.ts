import {secureRoute} from "@/engine/api/secure-route";
import {appsRepository as base} from "@/lib/db/apps-repository";
import {isUsable,type AppRecord,type ResponseRecord} from "@/engine/db/apps-repository-types";
import {buildAppState,publicUrlsFor,goneBody,stateEtag} from "@/engine/api/route-helpers";
import {prefetchBlocks} from "@/engine/responses/compute-results";
export function GET(req:Request,ctx:{params:Promise<{id:string}>}){return secureRoute(req,async()=>{
 const{id}=await ctx.params;if(!/^[a-f0-9]{24}$/.test(id))return Response.json(goneBody(null),{status:404});
 const snapshot=await base.snapshot(id);const app=snapshot?.app as unknown as AppRecord|null;
 if(!app||!isUsable(app))return Response.json(goneBody(app??null),{status:app?410:404});
 const etag=stateEtag(app,req);const headers={etag,"Cache-Control":"no-store",Vary:"Cookie, x-host-token, x-host-session, x-participant-token"};
 if(req.headers.get("if-none-match")===etag)return new Response(null,{status:304,headers});
 return Response.json(buildAppState(app,snapshot!.responses as unknown as ResponseRecord[],req,await prefetchBlocks(app.spec),await publicUrlsFor(app)),{headers});
});}
