import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppId } from "./contracts";
import { run } from "./docker-runtime";
import { putBackup } from "./artifacts";
export async function backupApp(id: string) {
  AppId.parse(id);
  const resource = `minintapp-${id}`;
  const inspected = JSON.parse(await run("docker", ["container", "inspect", resource]))[0];
  if (inspected.Config.Labels?.["io.minintapp.app"] !== id) throw new Error("Backup ownership mismatch");
  const directory = await mkdtemp(join(tmpdir(), "minint-backup-"));
  try {
    // VACUUM INTO takes a consistent SQLite snapshot while the runtime remains available.
    await run("docker", ["exec", resource, "node", "--input-type=module", "-e",
      "import {DatabaseSync} from 'node:sqlite';import{rmSync}from'node:fs';rmSync('/data/backup.sqlite',{force:true});const db=new DatabaseSync('/data/app.sqlite');db.exec(\"VACUUM INTO '/data/backup.sqlite'\");db.close();"]);
    const target = join(directory, "app.sqlite");
    await run("docker", ["cp", `${resource}:/data/backup.sqlite`, target]);
    await putBackup(id, await readFile(target));
    await run("docker", ["exec", resource, "node", "-e", "require('fs').unlinkSync('/data/backup.sqlite')"]);
  } finally { await rm(directory, { recursive: true, force: true }); }
}
