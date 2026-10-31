import {secureRoute} from "@/engine/api/secure-route";
import {createdResponse} from "@/engine/api/created-response";
import {appsRepository} from "@/engine/db/apps-repository";
import {tokenMatchesHash} from "@/engine/security/token-hashing";
export function POST(req:Request){return secureRoute(req,async()=>{const body=await req.json();if(typeof body.id!=="string"||typeof body.token!=="string"||body.token.length>64)return Response.json({ok:false},{status:400});const app=await appsRepository().findApp(body.id);if(!app||!tokenMatchesHash(body.token,app.hostTokenHash))return Response.json({ok:false},{status:403});return createdResponse(req,{ok:true,id:body.id,hostToken:body.token});});}
