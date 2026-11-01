import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHmac } from "node:crypto";
import { readFile, statfs } from "node:fs/promises";
import { appDatabaseURL } from "./app-database";
import { AppId, ImageDigest, RuntimeSeedSchema, type Deployment } from "./contracts";
const exec = promisify(execFile);
export const run = async (file: string, args: string[], maxBuffer = 2 * 1024 * 1024) => (await exec(file, args, { timeout: 120000, maxBuffer })).stdout.trim();
export const runtimeToken = (id: string) => createHmac("sha256", process.env.WORKER_TOKEN!).update(`runtime:${id}`).digest("hex");
export async function cachedImages() {
  const lines = (await run("docker", ["image", "ls", "--digests", "--format", "{{.Repository}}@{{.Digest}}"])).split("\n");
  const images = [...new Set(lines.filter((line) => ImageDigest.safeParse(line).success))];
  const supported: string[] = [];
  for (const image of images) if (await run("docker", ["image", "inspect", "--format", '{{index .Config.Labels "io.minintapp.runtime.storage"}}', image]) === "postgresql") supported.push(image);
  return supported;
}
const label = "io.minintapp.app";
const name = (id: string) => `minintapp-${AppId.parse(id)}`;
async function inspect(kind: "container" | "network" | "volume", id: string) {
  try { return JSON.parse(await run("docker", [kind, "inspect", id]))[0]; }
  catch (error) {
    const message = (error as { stderr?: string }).stderr || "";
    if (/no such (container|network|volume|object)|(?:network|volume|container) .+ not found/i.test(message)) return null;
    throw new Error("Docker inspection unavailable");
  }
}
function range(subnet: string) {
  const [address, bits = "32"] = subnet.split("/");
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(address)) return null;
  const value = address.split(".").reduce((total, octet) => total * 256 + Number(octet), 0);
  const size = 2 ** (32 - Number(bits));
  const start = Math.floor(value / size) * size;
  return [start, start + size - 1];
}
export function overlaps(a: string, b: string) {
  const left = range(a), right = range(b);
  return !!left && !!right && left[0] <= right[1] && right[0] <= left[1];
}
async function freeSubnet() {
  const ids = (await run("docker", ["network", "ls", "-q"])).split(/\s+/).filter(Boolean);
  const networks = ids.length ? JSON.parse(await run("docker", ["network", "inspect", ...ids])) : [];
  const routes = JSON.parse(await run("ip", ["-j", "-4", "route", "show", "table", "all"]));
  const used = [...networks.flatMap((network: { IPAM: { Config?: { Subnet?: string }[] } }) => (network.IPAM.Config || []).map((config) => config.Subnet).filter(Boolean)),
    ...routes.map((route: { dst?: string }) => route.dst).filter((dst: string) => dst && dst !== "default")];
  for (let slot = 128; slot < 192; slot++) {
    const candidate = `172.30.${slot}.0/28`;
    if (used.every((subnet: string) => !overlaps(candidate, subnet))) return candidate;
  }
  throw new Error("No non-overlapping sandbox subnet available");
}
async function freePort(id: string) {
  const ids = (await run("docker", ["ps", "-aq"])).split(/\s+/).filter(Boolean);
  const bindings = ids.length ? (await run("docker", ["container", "inspect", "--format", "{{json .HostConfig.PortBindings}}", ...ids])).split("\n").map((line) => JSON.parse(line)) : [];
  const reserved = new Set<number>(bindings.flatMap((ports: Record<string, { HostPort: string }[]> | null) =>
    Object.values(ports || {}).flatMap((values) => (values || []).map((port) => Number(port.HostPort)))));
  const sockets = await run("ss", ["-H", "-lnt"]);
  for (const line of sockets.split("\n")) {
    const endpoint = line.trim().split(/\s+/)[3];
    if (endpoint) reserved.add(Number(endpoint.split(":").at(-1)));
  }
  const offset = parseInt(id.slice(-6), 16) % 1000;
  for (let index = 0; index < 1000; index++) {
    const port = 12000 + (offset + index) % 1000;
    if (!reserved.has(port)) return port;
  }
  throw new Error("No available sandbox port");
}
async function firewall(bridge: string, remove = false) {
  const endpoint = new URL(process.env.RUNTIME_POSTGRES_URL!);
  const host = endpoint.hostname, port = Number(endpoint.port || 5432);
  if (!/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(host) || !/^\d+\.\d+\.\d+\.\d+$/.test(host) || !Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("PostgreSQL endpoint must be an explicit private IPv4 address/port");
  const apply = async (chain: string, rule: string[]) => {
    try { await run("iptables", ["-w", "-C", chain, ...rule]); if (remove) await run("iptables", ["-w", "-D", chain, ...rule]); }
    catch { if (!remove) await run("iptables", ["-w", "-I", chain, "1", ...rule]); }
  };
  for (const chain of ["INPUT", "DOCKER-USER"]) {
    const prefix = ["-i", bridge, "-m", "conntrack", "--ctstate", "NEW"];
    await apply(chain, [...prefix, "-m", "comment", "--comment", "minintapp-sandbox", "-j", "REJECT"]);
    // Only the configured database port is reachable; DNAT preserves its original destination.
    const target = chain === "INPUT" ? ["-d", host, "--dport", String(port)] : ["-m", "conntrack", "--ctorigdst", host, "--ctorigdstport", String(port), "--ctdir", "ORIGINAL"];
    await apply(chain, [...prefix, "-p", "tcp", ...target, "-m", "comment", "--comment", "minintapp-postgres", "-j", "ACCEPT"]);
  }
}
export async function provision(app: Deployment): Promise<number> {
  const id = AppId.parse(app.id), resource = name(id), bridge = `mi-${id.slice(0, 10)}`;
  const seed = RuntimeSeedSchema.parse(app.seed);
  const image = ImageDigest.parse(app.image);
  const current = await inspect("container", resource);
  if (current) {
    if (current.Config.Labels?.[label] !== id || current.Config.Image !== image) throw new Error("Container ownership/version mismatch");
    await firewall(bridge);
    if (!current.State.Running) await run("docker", ["start", resource]);
    const state = await inspect("container", resource);
    return Number(state.NetworkSettings.Ports["3000/tcp"][0].HostPort);
  }
  const memory = /MemAvailable:\s+(\d+)/.exec(await readFile("/proc/meminfo", "utf8"));
  if (!memory || Number(memory[1]) < 1536 * 1024) throw new Error("Insufficient host memory reserve");
  const dockerRoot = await run("docker", ["info", "--format", "{{.DockerRootDir}}"]);
  const disk = await statfs(dockerRoot);
  if (disk.bavail * disk.bsize < 10 * 1024 ** 3) throw new Error("Insufficient host disk reserve");
  const network = await inspect("network", resource);
  if (network && network.Labels?.[label] !== id) throw new Error("Network ownership mismatch");
  if (!network) await run("docker", ["network", "create", "--ipv6=false", "--subnet", await freeSubnet(), "--opt", `com.docker.network.bridge.name=${bridge}`, "--opt", "com.docker.network.bridge.enable_icc=false", "--label", `${label}=${id}`, resource]);
  await firewall(bridge);
  if (await run("docker", ["image", "inspect", "--format", '{{index .Config.Labels "io.minintapp.runtime.storage"}}', image]) !== "postgresql") throw new Error("Runtime image does not support PostgreSQL");
  const env = ["PLATFORM_ROLE=runtime", `RUNTIME_APP_ID=${id}`, `RUNTIME_SEED=${Buffer.from(JSON.stringify(seed)).toString("base64")}`,
    `DATABASE_URL=${appDatabaseURL(id, true)}`, `RUNTIME_TOKEN=${runtimeToken(id)}`, `IP_HASH_SALT=${runtimeToken(id)}`, `RUNTIME_HOSTNAME=${app.hostname}`, `APP_ORIGIN=https://${app.hostname}`];
  await run("docker", ["create", "--name", resource, "--label", `${label}=${id}`, "--runtime=runsc", "--network", resource, "--dns", "127.0.0.1",
    "--publish", `127.0.0.1:${await freePort(id)}:3000`, "--memory", "512m", "--memory-swap", "512m", "--cpus", "0.5", "--pids-limit", "128", "--read-only", "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges:true", "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
    "--log-opt", "max-size=5m", "--log-opt", "max-file=2", "--restart", "unless-stopped", ...env.flatMap((value) => ["--env", value]), image]);
  await run("docker", ["start", resource]);
  const state = await inspect("container", resource);
  return Number(state.NetworkSettings.Ports["3000/tcp"][0].HostPort);
}
export async function reclaim(id: string, destroyData = false) {
  const resource = name(id);
  const container = await inspect("container", resource);
  if (container) {
    if (container.Config.Labels?.[label] !== id) throw new Error("Container ownership mismatch");
    await run("docker", ["rm", "-f", resource]);
  }
  const network = await inspect("network", resource);
  if (network) {
    if (network.Labels?.[label] !== id) throw new Error("Network ownership mismatch");
    await run("docker", ["network", "rm", resource]);
    await firewall(`mi-${id.slice(0, 10)}`, true);
  }
  if (destroyData) {
    const volume = await inspect("volume", resource);
    if (volume && volume.Labels?.[label] === id) await run("docker", ["volume", "rm", resource]);
  }
}
