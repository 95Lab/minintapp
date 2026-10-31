import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { Pool } from "pg";
import { S3Client, DeleteBucketCommand } from "@aws-sdk/client-s3";
import { expect, it } from "vitest";
it("starts the bundled worker with central credentials, PostgreSQL, Redis and S3 and protects its private API", async () => {
  const directory = await mkdtemp(join(tmpdir(), "minint-worker-test-"));
  const credentials = join(directory, "api.env");
  const bucket = `minint-worker-test-${Date.now()}`;
  const database = new Pool({ connectionString: "postgresql://minintapp:local-integration-only@127.0.0.1:15439/minintapp_test" });
  expect((await database.query("SELECT current_database() AS name")).rows[0].name).toBe("minintapp_test");
  await database.query("TRUNCATE artifacts,deployments,workers CASCADE");
  await database.end();
  // Deliberately invalid provider credentials: no external provider calls are authorized by this test.
  await writeFile(credentials, "CLOUDFLARE_ZONE_ID=not-real\nCLOUDFLARE_API_TOKEN=not-real\nMININTAPP_WORKER_TOKEN=test-worker-only\nMININTAPP_S3_ACCESS_KEY_ID=minint-integration\nMININTAPP_S3_SECRET_ACCESS_KEY=only-local-testing-123456789\n", { mode: 0o600 });
  const child = spawn(process.execPath, [resolve(".platform/worker.mjs")], { env: { ...process.env,
    CENTRAL_API_ENV_FILE: credentials, DATABASE_URL: "postgresql://minintapp:local-integration-only@127.0.0.1:15439/minintapp_test", REDIS_URL: "redis://127.0.0.1:16389/15",
    WORKER_ID: "bundle-test", WORKER_AGENT_URL: "http://127.0.0.1:19092", WORKER_CAPACITY: "1", INGRESS_HOSTNAME: "ingress.example.test", DNS_AUTOMATION_APPROVED: "false",
    S3_ENDPOINT: "http://127.0.0.1:19009", S3_BUCKET: bucket, IS_EDGE_WORKER: "false", OPENAI_API_KEY: "",
  }, stdio: ["ignore", "pipe", "pipe"] });
  let diagnostics = "";
  child.stderr.on("data", (data) => { diagnostics += data.toString(); });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      if (child.exitCode !== null) throw new Error(`Worker exited: ${diagnostics.slice(-1000)}`);
      try {
        const result = await fetch("http://127.0.0.1:19092/health", { headers: { Authorization: "Bearer test-worker-only" } });
        if (result.ok && (await result.json()).workerId === "bundle-test") { ready = true; break; }
      } catch { /* startup */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(ready, diagnostics.slice(-1000)).toBe(true);
    expect((await fetch("http://127.0.0.1:19092/health")).status).toBe(403);
  } finally {
    if (child.exitCode === null) { const stopped = once(child, "exit"); child.kill("SIGTERM"); await stopped; }
    const client = new S3Client({ endpoint: "http://127.0.0.1:19009", region: "us-east-1", forcePathStyle: true, credentials: { accessKeyId: "minint-integration", secretAccessKey: "only-local-testing-123456789" } });
    try { await client.send(new DeleteBucketCommand({ Bucket: bucket })); } finally { client.destroy(); await rm(directory, { recursive: true, force: true }); }
  }
});
