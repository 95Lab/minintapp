import "server-only";
import { readSession } from "@/engine/auth/host-session";
import { OWNER_APP_LIMIT, type CreationAvailability } from "@/lib/api/creation-availability";
import { tenantIdentity } from "./deployments";
import { countOwnedDeployments } from "../../../platform/store";

export async function creationAvailability(request: Request): Promise<CreationAvailability> {
  if (process.env.PLATFORM_ROLE !== "control") return { used: 0, limit: null };
  const ownerId = readSession(request)?.userId || tenantIdentity(request).id;
  return { used: await countOwnedDeployments(ownerId), limit: OWNER_APP_LIMIT };
}
