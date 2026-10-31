export const dynamic = "force-dynamic";
// Liveness only: do not imply readiness of integrations that are not implemented.
export function GET() {
  return Response.json({ status: "ok", service: "minintapp", stage: "bootstrap" }, {
    headers: { "Cache-Control": "no-store" },
  });
}
