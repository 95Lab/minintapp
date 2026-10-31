import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pool } from "./store";
import { AppId } from "./contracts";
import type { DeploymentLog } from "../src/lib/api/deployment-management-contract";
const exec = promisify(execFile);
export function redactLogs(value: string, secrets: string[] = []) {
  let safe = value.replace(/\x1b\[[0-9;]*m/g, "").replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "");
  for (const secret of [...new Set(secrets)].filter(s => s.length >= 8).sort((a,b) => b.length-a.length)) safe = safe.split(secret).join("[REDACTED]");
  return safe.replace(/(postgres(?:ql)?:\/\/)[^\s"']+/gi, "$1[REDACTED]")
    .replace(/((?:authorization|password|secret|token|api[_-]?key|hostTokenHash)\s*["']?\s*[:=]\s*["']?)(?:Bearer\s+)?[^\s,"'}]+/gi, "$1[REDACTED]")
    .replace(/\b(?:sk-[\w-]+|[a-f0-9]{64}|[A-Za-z0-9_+\/-]{80,}={0,2})\b/g, "[REDACTED]");
}
export async function runtimeLogs(id: string): Promise<DeploymentLog[]> {
  AppId.parse(id);
  const resource = `minintapp-${id}`;
  const inspected = await exec("docker", ["container", "inspect", resource], { timeout: 5000, maxBuffer: 256 * 1024 });
  const container = JSON.parse(inspected.stdout)[0];
  if (container.Config.Labels?.["io.minintapp.app"] !== id) throw new Error("Log ownership mismatch");
  const secrets = (container.Config.Env as string[]).flatMap(value => {
    const raw = value.slice(value.indexOf("=")+1), values = [raw];
    if (/^(DATABASE_URL|RUNTIME_SEED)=/.test(value)) {
      try { if (value.startsWith("DATABASE_URL=")) values.push(decodeURIComponent(new URL(raw).password));
        else { const seed = JSON.parse(Buffer.from(raw,"base64").toString("utf8")); values.push(seed.hostTokenHash); } } catch { /* redact raw value */ }
    }
    return values;
  });
  const result = await exec("docker", ["logs", "--timestamps", "--tail", "100", resource], { timeout: 5000, maxBuffer: 512 * 1024 });
  return redactLogs(`${result.stdout}\n${result.stderr}`, secrets).split("\n").filter(Boolean).slice(-100).map((line, index) => {
    const match = /^(\d{4}-\d{2}-\d{2}T\S+)\s(.*)$/.exec(line);
    return { id: `live-${index}`, at: match?.[1] ?? new Date().toISOString(), source: "runtime", message: (match?.[2] ?? line).slice(0,4096) };
  });
}
export async function appendLog(id: string, message: string, source: "deployment" | "runtime" = "deployment", at?: string) {
  const timestamp = at && Number.isFinite(Date.parse(at)) ? new Date(at) : null;
  await pool.query("INSERT INTO app_logs(app_id,source,message,created_at) VALUES($1,$2,$3,COALESCE($4,now()))", [id, source, redactLogs(message).slice(0,4096), timestamp]);
}
export async function archiveRuntimeLogs(id: string) {
  const logs = await runtimeLogs(id);
  for (const log of logs) await appendLog(id, log.message, "runtime", log.at);
}
export async function storedLogs(id: string): Promise<DeploymentLog[]> {
  const rows = (await pool.query<{ id: string; created_at: Date; source: "deployment" | "runtime"; message: string }>(`SELECT id::text,created_at,source,message FROM app_logs WHERE app_id=$1 ORDER BY id DESC LIMIT 200`, [id])).rows;
  return rows.reverse().map(row => ({ id: row.id, at: row.created_at.toISOString(), source: row.source, message: row.message }));
}
export async function pruneLogs() {
  await pool.query(`DELETE FROM app_logs WHERE created_at<now()-interval '7 days' OR id IN
    (SELECT id FROM (SELECT id,row_number() OVER(PARTITION BY app_id ORDER BY id DESC) AS rank FROM app_logs) t WHERE rank>2000)`);
}
