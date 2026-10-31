import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export function verifyToken(token: string, expectedHash: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  return timingSafeEqual(Buffer.from(hashToken(token), "hex"), Buffer.from(expectedHash, "hex"));
}
export const participantHashFor = (appId: string, participantToken: string) => hashToken(`${participantToken}:${appId}`);
