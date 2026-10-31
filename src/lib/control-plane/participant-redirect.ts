import "server-only";
import { redirect } from "next/navigation";
import { deployment } from "../../../platform/store";
import { runtimePublicUrl } from "@/lib/runtime-plane/public-url";

/** Legacy participant links enter the app's own runtime once provisioning succeeds. */
export async function redirectManagedParticipant(id: string) {
  if (process.env.PLATFORM_ROLE !== "control") return;
  const url = runtimePublicUrl(id);
  if (!url) return;
  const app = await deployment(id);
  if (app?.state === "RUNNING" && app.expires_at.getTime() > Date.now() && new URL(url).hostname === app.hostname) redirect(url);
}
