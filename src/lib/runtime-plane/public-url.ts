import "server-only";
import {permittedAppHostname} from "@/lib/api/subdomain-schema";

const appIdPattern = /^[a-f0-9]{24}$/;
const domainPattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}$/;

/** Public navigation only: never attach host credentials to a cross-origin URL. */
export function runtimePublicUrl(id: string, hostname?:string): string | undefined {
  if (!appIdPattern.test(id)) return undefined;
  let domain: string | undefined;
  if (process.env.PLATFORM_ROLE === "control") domain = process.env.APPS_DOMAIN;
  if (process.env.PLATFORM_ROLE === "runtime") {
    // Derive sibling app origins from the worker-provided origin, never request Host.
    const ownId = process.env.RUNTIME_APP_ID;
    if (!ownId || !appIdPattern.test(ownId)) return undefined;
    try {
      const origin = new URL(process.env.APP_ORIGIN || "");
      if (origin.protocol !== "https:" || origin.port || origin.username || origin.password || (!origin.hostname.startsWith(`${ownId}.`)&&origin.hostname!==process.env.RUNTIME_HOSTNAME)) return undefined;
      domain = origin.hostname.slice(origin.hostname.indexOf(".")+1);
      if(!permittedAppHostname(origin.hostname,ownId,domain))return undefined;
      if(id===ownId)return `${origin.origin}/rooms/${id}`;
      if(!origin.hostname.startsWith(`${ownId}.`))return `https://${domain}/rooms/${id}`;
    } catch { return undefined; }
  }
  if (!domain || domain.length > 228 || !domainPattern.test(domain)) return undefined;
  if(hostname&&!permittedAppHostname(hostname,id,domain))return undefined;
  return `https://${hostname||`${id}.${domain}`}/rooms/${id}`;
}

export async function appPublicUrl(id:string){
 if(process.env.PLATFORM_ROLE!=="control"){
  if(process.env.PLATFORM_ROLE==="runtime"&&id!==process.env.RUNTIME_APP_ID&&appIdPattern.test(id)){
   const own=runtimePublicUrl(process.env.RUNTIME_APP_ID||"");if(!own)return undefined;const origin=new URL(own);origin.hostname=origin.hostname.slice(origin.hostname.indexOf(".")+1);return `${origin.origin}/rooms/${id}`;
  }
  return runtimePublicUrl(id);
 }
 const {deployment}=await import("../../../platform/store");
 const app=await deployment(id);return app?runtimePublicUrl(id,app.hostname):undefined;
}
