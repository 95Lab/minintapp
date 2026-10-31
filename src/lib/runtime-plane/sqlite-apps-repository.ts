import "server-only";
import { DatabaseSync } from "node:sqlite";
import { MemoryAppsRepository, type AppPersistence, type StoredApp } from "@/lib/db/memory-apps-repository";
import { initialRuntime } from "@/lib/blocks/block-definition-types";
import { RuntimeSeedSchema } from "../../../platform/contracts";

export class SQLiteAppPersistence implements AppPersistence {
  readonly db: DatabaseSync;
  constructor(path: string, readonly appId: string) {
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA max_page_count=65536; CREATE TABLE IF NOT EXISTS app_snapshot (id TEXT PRIMARY KEY, snapshot TEXT NOT NULL)");
  }
  load(): StoredApp[] {
    const row = this.db.prepare("SELECT snapshot FROM app_snapshot WHERE id=?").get(this.appId);
    return row ? [JSON.parse(row.snapshot as string)] : [];
  }
  save(value: StoredApp) {
    if (value.app.id !== this.appId) throw new Error("Runtime app boundary violation");
    this.db.prepare("INSERT INTO app_snapshot(id,snapshot) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET snapshot=excluded.snapshot").run(value.app.id, JSON.stringify(value));
  }
  delete(id: string) { this.db.prepare("DELETE FROM app_snapshot WHERE id=?").run(id); }
}
export function createRuntimeRepository(path: string, bootstrap: unknown) {
  const seed = RuntimeSeedSchema.parse(bootstrap);
  const storage = new SQLiteAppPersistence(path, seed.id);
  if (!storage.load().length) storage.save({ app: {
    ...seed, status: "active", runtime: initialRuntime(), stateVersion: 1,
    parentId: null, movedTo: null, endedAt: null, announcement: null,
  }, responses: [] });
  return new MemoryAppsRepository(Date.now, { apps: 1, responses: 1000 }, storage);
}
