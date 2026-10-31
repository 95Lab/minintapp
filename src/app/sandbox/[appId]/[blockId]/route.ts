// GET /sandbox/[appId]/[blockId] — the page of a `custom` block, framed by the app screens inside
// <iframe sandbox="allow-scripts">. It carries its own strict CSP (src/lib/blocks/custom/sandbox-document.ts)
// and is exempt from the nonce CSP of src/proxy.ts. The html is the same text every participant already
// receives in the app spec, so no token is needed; expired / ended / blocked apps answer like other routes.
// It only ever renders inside our iframe: a browser sets `Sec-Fetch-Dest: iframe` for a frame load and
// `document` for a page opened directly, so a shared /sandbox link can never act as a page of our origin.
import { appsRepository, isUsable } from "@/engine/db/apps-repository";
import { buildSandboxDocument, SANDBOX_HEADERS } from "@/engine/blocks/custom/sandbox-document";

const notFound = () => new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

export async function GET(req: Request, ctx: { params: Promise<{ appId: string; blockId: string }> }) {
  if (req.headers.get("sec-fetch-dest") !== "iframe") return notFound();
  const { appId, blockId } = await ctx.params;
  const app = await appsRepository().findApp(appId);
  if (!isUsable(app)) return notFound();
  const block = app.spec.blocks.find((b) => b.id === blockId);
  if (!block || block.type !== "custom") return notFound();
  return new Response(buildSandboxDocument(block.html), { status: 200, headers: SANDBOX_HEADERS });
}
