import {secureRoute} from "@/engine/api/secure-route";
// POST /api/engine/apps/[id]/photos?block=<blockId> — a participant uploads one photo (raw JPEG/PNG/WebP body,
// already resized on the phone). The type is checked from the file's first bytes, not the header;
// size, per-person and per-app caps apply. Returns the photo id, which the participant then submits
// as the photo input's answer. Nobody else sees it until the host approves it.
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { jsonError, PARTICIPANT_TOKEN_HEADER, resolveUsableApp } from "@/engine/api/route-helpers";
import { MAX_PHOTO_BYTES, MAX_PHOTO_UPLOADS_PER_PERSON, MAX_PHOTOS_PER_APP, rosterIdOf } from "@/engine/blocks/compose/compose-atoms-schema";
import { appsRepository, participantHashFor } from "@/engine/db/apps-repository";
import { checkRateLimit, clientIpHash } from "@/engine/security/security-interfaces";

/** Image type from the file's magic bytes (never trust the declared content type). */
function sniffImage(b: Uint8Array): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

/** Reads the body, stopping (null) as soon as it passes `max` bytes — a chunked upload can't make us buffer more. */
async function readAtMost(req: Request, max: number): Promise<Uint8Array | null> {
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

const randomPart = () => Array.from(randomBytes(10), (x) => (x % 36).toString(36)).join("");

async function handlePOST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const resolved = await resolveUsableApp(id);
  if ("gone" in resolved) return resolved.gone;
  const { app } = resolved;
  if (app.status !== "active") return jsonError(409, "app_closed");

  const token = req.headers.get(PARTICIPANT_TOKEN_HEADER);
  if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) return jsonError(400, "bad_request");
  const blockId = new URL(req.url).searchParams.get("block");
  const block = app.spec.blocks.find((b) => b.id === blockId);
  if (!block || block.type !== "compose" || !block.inputs.some((i) => i.kind === "photo")) return jsonError(400, "unknown_block");

  const participantHash = participantHashFor(app.id, token);
  // Tokens are chosen by the client: limit per network too, as answers are.
  const [perPerson, perIp] = await Promise.all([checkRateLimit("respond", participantHash), checkRateLimit("respond_ip", `${app.id}:${clientIpHash(req)}`)]);
  if (!perPerson.ok || !perIp.ok) return jsonError(429, "rate_limited");

  if (Number(req.headers.get("content-length") ?? 0) > MAX_PHOTO_BYTES) return jsonError(413, "photo_too_large");
  const bytes = await readAtMost(req, MAX_PHOTO_BYTES);
  if (!bytes || bytes.length === 0) return jsonError(413, "photo_too_large");
  const mime = sniffImage(bytes);
  if (!mime) return jsonError(415, "photo_not_image");

  const photoId = `p-${rosterIdOf(participantHash)}-${randomPart()}`;
  const outcome = await appsRepository().addPhoto(app.id, { id: photoId, participantHash, mime, bytes }, { perPerson: MAX_PHOTO_UPLOADS_PER_PERSON, perApp: MAX_PHOTOS_PER_APP });
  if (outcome === "gone") return jsonError(410, "app_ended_or_moved");
  if (outcome === "closed") return jsonError(409, "app_closed");
  if (outcome === "limit") return jsonError(429, "photo_limit", { max: MAX_PHOTO_UPLOADS_PER_PERSON });
  return NextResponse.json({ ok: true, photoId });
}

export const POST=(...args:Parameters<typeof handlePOST>)=>secureRoute(args[0],()=>handlePOST(...args));
