import { AppId } from "./contracts";
import { readAppDatabase } from "./app-database";
import { putBackup } from "./artifacts";
export async function backupApp(id: string) {
  AppId.parse(id);
  const snapshot = await readAppDatabase(id);
  if (!snapshot || snapshot.app.id !== id) throw new Error("Backup ownership mismatch");
  // A single SELECT returns a consistent committed JSONB snapshot, including photos/responses.
  await putBackup(id, Buffer.from(JSON.stringify({ format: "minintapp-postgres-v1", appId: id, snapshot })));
}
