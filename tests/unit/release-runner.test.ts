import { expect, it, vi } from "vitest";
import { runRelease, type ReleaseOperations } from "../../platform/release-runner";
import { specDigest, type Release } from "../../platform/release-store";
import type { Deployment } from "../../platform/contracts";
import { composeSpec } from "@/lib/app-spec/app-spec-examples";
const id = "a".repeat(24);
const seed = { id, spec: composeSpec(), prompt: "vote", ownerId: "owner", hostTokenHash: "b".repeat(64), createdAt: 1, expiresAt: Date.now()+60000 };
const old: Release = { app_id: id, version: 1, image: `ghcr.io/95lab/minintapp@sha256:${"1".repeat(64)}`, seed, spec_digest: specDigest(seed), status: "SUCCEEDED", switch_started: false, previous_version: null, rollback_of: null, created_at: new Date(), completed_at: new Date() };
const target: Release = { ...old, version: 2, image: `ghcr.io/95lab/minintapp@sha256:${"2".repeat(64)}`, status: "PENDING", previous_version: 1 };
const app = { id, active_version: 1, requested_version: 2 } as Deployment;
function setup() {
  const calls: string[] = [];
  const ops: ReleaseOperations = {
    previous: vi.fn(async () => old), artifact: vi.fn(async () => { calls.push("artifact"); }),
    backup: vi.fn(async () => { calls.push("backup"); }), beginSwitch: vi.fn(async () => { calls.push("begin-switch"); }), archive: vi.fn(async () => { calls.push("archive"); }),
    stop: vi.fn(async () => { calls.push("stop"); }), activate: vi.fn(async value => { calls.push(`activate-${value.version}`); }),
    complete: vi.fn(async (value, failed) => { calls.push(`complete-${value.version}-${failed ?? "ok"}`); }), log: vi.fn(async () => {}),
  };
  return { ops, calls };
}
it("backs up and fences the old runtime before switching, then promotes only after health succeeds", async () => {
  const { ops, calls } = setup();
  await runRelease(app, target, ops);
  expect(calls).toEqual(["artifact", "backup", "archive", "begin-switch", "stop", "activate-2", "complete-2-ok"]);
  expect(ops.complete).toHaveBeenCalledWith(target);
});
it("automatically restores the previous image on failed activation without restoring data", async () => {
  const { ops, calls } = setup();
  vi.mocked(ops.activate).mockImplementationOnce(async () => { calls.push("bad-health"); throw Error("private detail"); });
  await runRelease(app, target, ops);
  expect(calls).toEqual(["artifact", "backup", "archive", "begin-switch", "stop", "bad-health", "archive", "stop", "activate-1", "complete-1-2"]);
  expect(ops.complete).not.toHaveBeenCalledWith(target);
  expect(JSON.stringify(vi.mocked(ops.log).mock.calls)).not.toContain("private detail");
});
it("does not promote either image if recovery also fails", async () => {
  const { ops } = setup(); vi.mocked(ops.activate).mockRejectedValue(Error("unreachable"));
  await expect(runRelease(app, target, ops)).rejects.toThrow();
  expect(ops.complete).not.toHaveBeenCalled();
});
it("rejects a cross-app or incompatible manifest before touching the runtime", async () => {
  const { ops } = setup();
  await expect(runRelease(app, { ...target, seed: { ...seed, id: "c".repeat(24) } }, ops)).rejects.toThrow("manifest");
  expect(ops.stop).not.toHaveBeenCalled();
  vi.mocked(ops.previous).mockResolvedValue({ ...old, spec_digest: "different" });
  await expect(runRelease(app, target, ops)).rejects.toThrow("compatible");
  expect(ops.backup).not.toHaveBeenCalled();
});
it("can retry a switch after a worker crash and can resume the active release without switching", async () => {
  const { ops } = setup();
  await runRelease(app, target, ops); await runRelease(app, target, ops);
  expect(ops.stop).toHaveBeenCalledTimes(2);
  const resumed = setup(); await runRelease({ ...app, requested_version: null }, old, resumed.ops);
  expect(resumed.ops.stop).not.toHaveBeenCalled(); expect(resumed.ops.backup).not.toHaveBeenCalled();
});

it("leaves the old writer in place when backup fails, but recovers a switch already started before a crash", async () => {
  const { ops } = setup(); vi.mocked(ops.backup).mockRejectedValue(Error("backup offline"));
  await runRelease(app, target, ops);
  expect(ops.stop).not.toHaveBeenCalled(); expect(ops.activate).toHaveBeenCalledWith(old);
  expect(ops.complete).toHaveBeenCalledWith(old, 2);
  await runRelease(app, { ...target, switch_started: true }, ops);
  expect(ops.stop).toHaveBeenCalledOnce();
});
