// Token hashing + constant-time comparison (host tokens, participant identities, IP hashes).
import { createHash, timingSafeEqual } from "node:crypto";

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function tokenMatchesHash(raw: string | null | undefined, expectedHash: string): boolean {
  if (!raw) return false;
  const a = Buffer.from(hashToken(raw), "hex");
  const b = Buffer.from(expectedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
