// True when the request carries the team's presenter key (demo laptop, rehearsals, eval runs).
// Presenter requests get raised rate-limit ceilings applied by the caller; this function only
// answers the identity question. Compared as hashes in constant time.
import { runtimeConfig } from "@/engine/config/runtime-config";
import { hashToken, tokenMatchesHash } from "./token-hashing";

export function isPresenter(req: Request): boolean {
  if (!runtimeConfig.presenterKey) return false;
  return tokenMatchesHash(req.headers.get("x-presenter-key"), hashToken(runtimeConfig.presenterKey));
}
