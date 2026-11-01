import {checkRateLimit,clientIpHash} from "@/engine/security/security-interfaces";
import {SubdomainSchema} from "@/lib/api/subdomain-schema";
import {subdomainAvailable} from "@/lib/control-plane/subdomains";
import {errorResponse} from "@/lib/api/route-helpers";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const domain=process.env.APPS_DOMAIN;const supported=process.env.PLATFORM_ROLE==="control"&&!!domain;
 const name=new URL(request.url).searchParams.get("name");
 if(!supported)return Response.json({supported:false},{headers:{"Cache-Control":"no-store"}});
 if(name===null)return Response.json({supported:true,domain},{headers:{"Cache-Control":"no-store"}});
 const parsed=SubdomainSchema.safeParse(name);if(!parsed.success)return Response.json({code:"subdomain_invalid"},{status:400});
 try{const limit=await checkRateLimit("subdomain",clientIpHash(request));if(!limit.ok)return Response.json({code:"rate_limited"},{status:429,headers:{"Retry-After":String(limit.retryAfterSec||60),"Cache-Control":"no-store"}});return Response.json({supported:true,domain,name:parsed.data,available:await subdomainAvailable(`${parsed.data}.${domain}`)},{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}
}
