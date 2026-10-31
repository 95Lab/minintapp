import { RuntimeSeedSchema, ImageDigest, type Deployment } from "./contracts";
import { specDigest, type Release } from "./release-store";
export type ReleaseOperations = {
  previous: (version: number) => Promise<Release | null>;
  artifact: (target: Release) => Promise<void>;
  backup: () => Promise<void>; beginSwitch: () => Promise<void>; archive: () => Promise<void>;
  stop: () => Promise<void>; activate: (target: Release) => Promise<void>;
  complete: (target: Release, failedVersion?: number) => Promise<void>;
  committed: (version: number) => Promise<boolean>;
  log: (message: string) => Promise<void>;
};
/** The old writer is stopped before the replacement starts. Release manifests never change app data. */
export async function runRelease(app: Deployment, target: Release, ops: ReleaseOperations) {
  const seed = RuntimeSeedSchema.parse(target.seed);
  ImageDigest.parse(target.image);
  if (seed.id !== app.id || specDigest(seed) !== target.spec_digest) throw new Error("Invalid release manifest");
  const switching = app.active_version !== null && app.active_version !== target.version;
  const previous = switching ? await ops.previous(app.active_version!) : null;
  if (switching && (!previous || previous.status !== "SUCCEEDED" || previous.spec_digest !== target.spec_digest)) throw new Error("No compatible recovery release");
  let displaced = target.switch_started;
  await ops.log(`release v${target.version}: preparing`);
  try {
    await ops.artifact(target);
    if (switching) {
      await ops.backup();
      await ops.log(`release v${target.version}: backup complete`);
      await ops.archive();
      await ops.beginSwitch();
      displaced = true;
      await ops.stop();
    }
    await ops.activate(target);
    await ops.complete(target);
  } catch {
    // A lost COMMIT acknowledgement must not undo a release already promoted in PostgreSQL.
    if (await ops.committed(target.version)) return;
    if (!previous) throw new Error("Release activation failed");
    await ops.log(`release v${target.version}: failed; restoring v${previous.version}`);
    // Recovery is idempotent after a worker crash, and uses the same database without reverting writes.
    if (displaced) {
      await ops.archive(); await ops.stop();
      await ops.activate(previous);
    }
    await ops.complete(previous, target.version);
    await ops.log(`release v${target.version}: failed; v${previous.version} restored`);
    return;
  }
  await ops.log(`release v${target.version}: running`);
}
