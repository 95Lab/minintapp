import "server-only";
import {pool} from "../../../platform/store";
import {readyWorkerAgents} from "./worker-agents";
import {AppError} from "@/lib/api/app-error-codes";
export async function dnsNameAvailable(hostname:string,database?:Pick<typeof pool,"query">){
 const [agent]=await readyWorkerAgents(database);if(!agent)throw new AppError("runtime_unavailable");
 const response=await fetch(`${agent}/dns-availability?hostname=${encodeURIComponent(hostname)}`,{headers:{Authorization:`Bearer ${process.env.WORKER_TOKEN}`},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(18000)});
 if(!response.ok)throw new AppError("runtime_unavailable");const body=await response.json();if(typeof body.available!=="boolean")throw new AppError("runtime_unavailable");return body.available as boolean;
}
export async function subdomainAvailable(hostname:string){const result=await pool.query("SELECT 1 FROM deployments WHERE hostname=$1 LIMIT 1",[hostname]);return result.rowCount===0&&await dnsNameAvailable(hostname);}
