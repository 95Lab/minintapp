// Salted hash of the caller's IP (first x-forwarded-for hop). Raw IPs are never stored or
// logged — only this hash, so security_events/rate_limits stay useful for abuse tracing without
// keeping PII around longer than needed.
import { runtimeConfig } from "@/engine/config/runtime-config";
import { hashToken } from "./token-hashing";

export function clientIpHash(req: Request): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  return hashToken(`${runtimeConfig.ipHashSalt}:${ip}`);
}
