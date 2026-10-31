export const dynamic = "force-dynamic";
// Liveness only: do not imply readiness of integrations that are not implemented.
export async function GET() {
  if (process.env.PLATFORM_ROLE === "runtime") {
    const { appsRepository } = await import("@/lib/db/apps-repository");
    if (!(await appsRepository.findApp(process.env.RUNTIME_APP_ID!))) return Response.json({ status: "unavailable" }, { status: 503 });
  }
  return Response.json({ status: "ok", service: "minintapp", stage: process.env.PLATFORM_ROLE || "bootstrap", ...(process.env.PLATFORM_ROLE === "runtime" ? { appId: process.env.RUNTIME_APP_ID } : {}) }, {
    headers: { "Cache-Control": "no-store" },
  });
}
