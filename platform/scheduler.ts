import type { Queue } from "bullmq";
import { pool, reserveWorker } from "./store";
export async function dispatchOutbox(queue: (id: string) => Pick<Queue, "add">) {
  const pending = await pool.query<{ id: string; revision: number }>("SELECT id,revision FROM deployments WHERE state='QUEUED' AND queued_at IS NULL AND expires_at>now() ORDER BY created_at LIMIT 20");
  for (const row of pending.rows) {
    try {
      const target = await reserveWorker(row.id);
      await queue(target).add("provision", { id: row.id }, { jobId: `${row.id}-v${row.revision}`, attempts: 3, backoff: { type: "exponential", delay: 3000 }, removeOnComplete: { age: 86400, count: 1000 }, removeOnFail: { age: 86400, count: 1000 } });
      await pool.query("UPDATE deployments SET queued_at=now() WHERE id=$1", [row.id]);
    } catch { /* Durable outbox remains available for retry. */ }
  }
}
