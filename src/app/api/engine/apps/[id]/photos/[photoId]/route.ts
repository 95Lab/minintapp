import {secureRoute} from "@/engine/api/secure-route";
// GET /api/engine/apps/[id]/photos/[photoId]?s=<signature> — serves one uploaded photo. The signed URL is only
// handed out by the results to people allowed to see the photo (host, its author, everyone after
// approval), so the signature is the permission. Gone with the app.
import { NextResponse } from "next/server";
import { PHOTO_ID } from "@/engine/blocks/compose/compose-atoms-schema";
import { appsRepository, isExpired } from "@/engine/db/apps-repository";
import { photoSignatureOk } from "@/engine/security/photo-url-signing";

async function handleGET(req: Request, ctx: { params: Promise<{ id: string; photoId: string }> }) {
  const { id, photoId } = await ctx.params;
  if (!PHOTO_ID.test(photoId) || !photoSignatureOk(id, photoId, new URL(req.url).searchParams.get("s"))) {
    return new NextResponse(null, { status: 404 });
  }
  const app = await appsRepository().findApp(id);
  if (!app || isExpired(app) || app.status === "blocked") return new NextResponse(null, { status: 404 });
  const photo = await appsRepository().getPhoto(id, photoId);
  if (!photo) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(photo.bytes), {
    headers: {
      "content-type": photo.mime,
      "content-length": String(photo.bytes.length),
      // private: a signed URL is a permission for one viewer; never cache it on a shared proxy
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
      "content-disposition": "inline",
    },
  });
}

export const GET=(...args:Parameters<typeof handleGET>)=>secureRoute(args[0],()=>handleGET(...args));
