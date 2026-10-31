import {requireSameOrigin} from "@/lib/host/host-session";
import {AppError} from "@/lib/api/app-error-codes";
export async function secureRoute(request:Request,run:()=>Promise<Response>) {
 try{if(!["GET","HEAD"].includes(request.method))requireSameOrigin(request);return await run();}
 catch(error){const status=error instanceof AppError?(error.code==="forbidden"?403:error.code==="storage_unavailable"?503:error.code==="rate_limited"?429:error.code==="question_closed"?409:400):500;return Response.json({ok:false,code:error instanceof AppError?error.code:"unknown",message:"Không thể xử lý yêu cầu."},{status,headers:{"Cache-Control":"no-store"}});}
}
