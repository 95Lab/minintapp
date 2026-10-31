import { mkdir, rename, writeFile, unlink, readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { AppId } from "./contracts";
const directory = () => process.env.TRAEFIK_ROUTES_DIR || "/opt/minintapp/routes";
export async function publishRoute(id: string, hostname: string, port: number, upstream?: string) {
  AppId.parse(id);
  if (!/^[a-z0-9.-]+$/.test(hostname) || !Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid gateway route");
  await mkdir(directory(), { recursive: true });
  const config = { http: { routers: { [id]: { rule: `Host(\`${hostname}\`)`, service: id, entryPoints: ["apps"], middlewares: [`private-api-${id}`] } },
    middlewares: { [`private-api-${id}`]: { replacePathRegex: { regex: "^/api/internal/.*", replacement: "/not-found" } } },
    services: { [id]: { loadBalancer: { servers: [{ url: upstream || `http://127.0.0.1:${port}` }] } } } } };
  const target = join(directory(), `${id}.yml`);
  const content = JSON.stringify(config);
  if (await readFile(target, "utf8").catch(() => "") === content) return;
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, content, { mode: 0o640 });
  await rename(temporary, target);
}
export async function unpublishRoute(id: string) {
  AppId.parse(id);
  await unlink(join(directory(), `${id}.yml`)).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
}
