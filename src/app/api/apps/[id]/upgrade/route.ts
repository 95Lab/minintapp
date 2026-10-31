import {NextResponse} from "next/server";
import {requireApp} from "@/lib/api/poll-service";
import {requireHost,hostCookieName,secureHostCookie} from "@/lib/host/host-session";
import {errorResponse} from "@/lib/api/route-helpers";
export async function GET(request:Request,context:RouteContext<"/api/apps/[id]/upgrade">){try{const{id}=await context.params;const app=await requireApp(id);const token=requireHost(request,app);const response=NextResponse.redirect(new URL(`/rooms/${id}/host`,request.url));response.cookies.set(hostCookieName(id),token,{httpOnly:true,sameSite:"lax",secure:secureHostCookie(request),path:"/api/engine",maxAge:90*86400});return response;}catch(error){return errorResponse(error);}}
