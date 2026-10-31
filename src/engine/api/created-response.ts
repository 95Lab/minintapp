import {NextResponse} from "next/server";
import {secureHostCookie,hostCookieName} from "@/lib/host/host-session";
export function createdResponse(request:Request,body:{id?:string;newId?:string;hostToken:string;[key:string]:unknown}) {
 const id=body.id??body.newId!;const response=NextResponse.json(body,{status:body.newId?200:201});
 response.cookies.set(hostCookieName(id),body.hostToken,{httpOnly:true,sameSite:"lax",secure:secureHostCookie(request),path:"/api/engine",maxAge:90*86400});
 return response;
}
