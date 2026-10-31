// Photo URLs carry an HMAC so an <img> (which can't send a token header) can load a photo, while only
// people the server chose to show it to (host, its author, everyone once the host approved it) ever
// receive a working URL. The key is a server secret; ids are random, so URLs can't be guessed.
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { signingKeyFor } from "./server-signing-key";

const sign = (appId: string, photoId: string) => createHmac("sha256", signingKeyFor("photo")).update(`${appId}:${photoId}`).digest("base64url").slice(0, 22);

export const photoUrl = (appId: string, photoId: string) => `/api/engine/apps/${appId}/photos/${photoId}?s=${sign(appId, photoId)}`;

export function photoSignatureOk(appId: string, photoId: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = Buffer.from(sign(appId, photoId));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
