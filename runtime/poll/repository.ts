import "server-only";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import type { PollRuntimeManifest } from "../../src/lib/blocks/poll-runtime-schema.js";
import { PollVoteRequestSchema, type PollRuntimeState, type PollVoteRequest, type PollHostAction } from "../../src/lib/api/poll-runtime-contract.js";

export class PollError extends Error {
  constructor(readonly code: "expired" | "ended" | "closed" | "invalid_vote" | "name_required" | "capacity_reached") { super(code); }
}
/** One SQLite database belongs to exactly one immutable deployment manifest. */
export class PollRepository {
  private readonly db: DatabaseSync;
  constructor(path: string, readonly manifest: PollRuntimeManifest, private readonly now = Date.now) {
    this.db = new DatabaseSync(path);
    try {
      this.db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;");
      const version = this.db.prepare("PRAGMA user_version").get() as { user_version: number };
      if (version.user_version !== 0 && version.user_version !== 1) throw new Error("unsupported_database_version");
      this.db.exec(`CREATE TABLE IF NOT EXISTS runtime (id INTEGER PRIMARY KEY CHECK(id=1), manifest TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('open','closed','ended')));
        CREATE TABLE IF NOT EXISTS votes (participant_hash TEXT PRIMARY KEY, option_id TEXT NOT NULL, display_name TEXT, updated_at INTEGER NOT NULL);
        PRAGMA user_version=1;`);
      this.db.prepare("INSERT OR IGNORE INTO runtime(id,manifest,status) VALUES(1,?,'open')").run(JSON.stringify(manifest));
      const row = this.db.prepare("SELECT manifest FROM runtime WHERE id=1").get() as { manifest: string };
      if (row.manifest !== JSON.stringify(manifest)) throw new Error("runtime_volume_mismatch");
    } catch (error) { this.db.close(); throw error; }
  }
  close() { this.db.close(); }
  private status() { return (this.db.prepare("SELECT status FROM runtime WHERE id=1").get() as { status: "open" | "closed" | "ended" }).status; }
  health() {
    this.db.prepare("SELECT 1").get();
    return { status: "ok", service: "minint-poll-runtime", templateVersion: this.manifest.templateVersion, deploymentId: this.manifest.deploymentId, specHash: this.manifest.specHash, expiresAt: this.manifest.expiresAt, expired: this.now() >= this.manifest.expiresAt, ended: this.status() === "ended" };
  }
  private usable() {
    if (this.now() >= this.manifest.expiresAt) throw new PollError("expired");
    if (this.status() === "ended") throw new PollError("ended");
  }
  private participant(token: string) { return createHash("sha256").update(`${this.manifest.appId}:${token}`).digest("hex"); }
  state(token: string | null, host = false): PollRuntimeState {
    this.usable();
    const status = this.status();
    if (status === "ended") throw new PollError("ended");
    const mine = token ? this.db.prepare("SELECT option_id,display_name FROM votes WHERE participant_hash=?").get(this.participant(token)) as { option_id: string; display_name: string | null } | undefined : undefined;
    const visibility = this.manifest.resultsVisibility;
    const visible = host || visibility === "everyone" || (visibility === "after_submit" && !!mine) || (visibility === "after_close" && status === "closed");
    let results: PollRuntimeState["results"] = null;
    if (visible) {
      const rows = this.db.prepare("SELECT option_id,count(*) AS count FROM votes GROUP BY option_id").all() as { option_id: string; count: number }[];
      results = { total: rows.reduce((sum, r) => sum + r.count, 0), counts: Object.fromEntries(this.manifest.options.map(o => [o.id, rows.find(r => r.option_id === o.id)?.count ?? 0])) };
    }
    const m = this.manifest;
    return { title: m.title, description: m.description, blockTitle: m.blockTitle, note: m.note, question: m.question, resultsTitle: m.resultsTitle, locale: m.locale, theme: m.theme, requireName: m.requireName, options: m.options, expiresAt: m.expiresAt, status, myOptionId: mine?.option_id ?? null, myDisplayName: mine?.display_name ?? null, results };
  }
  vote(token: string, raw: PollVoteRequest) {
    const input = PollVoteRequestSchema.parse(raw);
    if (!this.manifest.options.some(o => o.id === input.optionId)) throw new PollError("invalid_vote");
    if (this.manifest.requireName && !input.displayName) throw new PollError("name_required");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.usable();
      if (this.status() !== "open") throw new PollError("closed");
      const participant = this.participant(token);
      const exists = this.db.prepare("SELECT 1 FROM votes WHERE participant_hash=?").get(participant);
      const count = this.db.prepare("SELECT count(*) AS count FROM votes").get() as { count: number };
      if (!exists && count.count >= 1000) throw new PollError("capacity_reached");
      this.db.prepare("INSERT INTO votes(participant_hash,option_id,display_name,updated_at) VALUES(?,?,?,?) ON CONFLICT(participant_hash) DO UPDATE SET option_id=excluded.option_id,display_name=excluded.display_name,updated_at=excluded.updated_at").run(participant, input.optionId, input.displayName ?? null, this.now());
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    return this.state(token);
  }
  action(action: PollHostAction["action"]) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.usable();
      if (action === "end") this.db.exec("DELETE FROM votes");
      this.db.prepare("UPDATE runtime SET status=? WHERE id=1").run(action === "close" ? "closed" : action === "reopen" ? "open" : "ended");
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
}
