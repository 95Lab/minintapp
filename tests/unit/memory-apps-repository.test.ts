import { describe, expect, it } from "vitest";
import { MemoryAppsRepository } from "@/lib/db/memory-apps-repository";
import { composeSpec } from "@/lib/app-spec/app-spec-examples";
import { computePollResults } from "@/lib/responses/compute-results";
import { participantHashFor, verifyToken } from "@/lib/security/token-hashing";
const input = () => ({ spec: composeSpec(), prompt: "poll", lifetimeMs: 3600_000 });
const vote = (id: string, who = "one", choice = "tea") => ({ blockId: "poll", itemId: "", participantHash: participantHashFor(id, who), displayName: null, payload: { kind: "compose" as const, values: { drink: choice } } });
describe("memory app storage", () => {
  it("stores only the host hash and returns detached snapshots", async () => {
    const repo = new MemoryAppsRepository();
    const { app, hostToken } = await repo.createApp(input());
    expect(verifyToken(hostToken, app.hostTokenHash)).toBe(true);
    expect(app.hostTokenHash).not.toBe(hostToken);
    app.status = "ended";
    expect((await repo.findApp(app.id))?.status).toBe("active");
  });
  it("upserts a vote and aggregates concurrent participants without lost updates", async () => {
    const repo = new MemoryAppsRepository();
    const { app } = await repo.createApp(input());
    await Promise.all(Array.from({ length: 100 }, (_, i) => repo.submitResponse(app.id, vote(app.id, `person-${i}`))));
    await repo.submitResponse(app.id, vote(app.id, "person-0", "coffee"));
    const snapshot = await repo.snapshot(app.id);
    expect(snapshot?.responses).toHaveLength(100);
    expect(snapshot?.app.stateVersion).toBe(102);
    expect(computePollResults(app.spec, snapshot!.responses)[0].items.map((i) => i.count)).toEqual([99, 1]);
  });
  it("isolates apps and enforces host permissions for lifecycle changes", async () => {
    const repo = new MemoryAppsRepository();
    const first = await repo.createApp(input());
    const second = await repo.createApp(input());
    await repo.submitResponse(first.app.id, vote(first.app.id));
    expect(await repo.listResponses(second.app.id)).toEqual([]);
    await expect(repo.transition(second.app.id, first.hostToken, "close")).rejects.toMatchObject({ code: "forbidden" });
    await repo.transition(first.app.id, first.hostToken, "close");
    expect(await repo.submitResponse(first.app.id, vote(first.app.id))).toBe("closed");
    await repo.transition(first.app.id, first.hostToken, "reopen");
    expect(await repo.submitResponse(first.app.id, vote(first.app.id))).toBe("ok");
    await repo.transition(first.app.id, first.hostToken, "end");
    expect(await repo.listResponses(first.app.id)).toEqual([]);
    await expect(repo.transition(first.app.id, first.hostToken, "reopen")).rejects.toMatchObject({ code: "app_gone" });
  });
  it("refuses expired writes and purges expired apps when creating again", async () => {
    let now = 1000;
    const repo = new MemoryAppsRepository(() => now, { apps: 1, responses: 1 });
    const first = await repo.createApp({ ...input(), lifetimeMs: 10 });
    now += 10;
    expect(await repo.submitResponse(first.app.id, vote(first.app.id))).toBe("gone");
    now += 600_000;
    await repo.createApp(input());
    expect(await repo.findApp(first.app.id)).toBeNull();
  });
  it("caps new responses while allowing a participant to change an existing vote", async () => {
    const repo = new MemoryAppsRepository(Date.now, { apps: 1, responses: 1 });
    const { app } = await repo.createApp(input());
    expect(await repo.submitResponse(app.id, vote(app.id))).toBe("ok");
    expect(await repo.submitResponse(app.id, vote(app.id, "two"))).toBe("limit");
    expect(await repo.submitResponse(app.id, vote(app.id, "one", "coffee"))).toBe("ok");
    await expect(repo.createApp(input())).rejects.toMatchObject({ code: "rate_limited" });
  });
  it("validates the vote against this app before writing", async () => {
    const repo = new MemoryAppsRepository();
    const { app } = await repo.createApp(input());
    await expect(repo.submitResponse(app.id, vote(app.id, "one", "fake"))).rejects.toMatchObject({ code: "invalid_request" });
    await expect(repo.submitResponse(app.id, { ...vote(app.id), blockId: "another-app-block" })).rejects.toMatchObject({ code: "invalid_request" });
    await expect(repo.submitResponse(app.id, { ...vote(app.id), itemId: "extra" })).rejects.toMatchObject({ code: "invalid_request" });
    expect(await repo.listResponses(app.id)).toHaveLength(0);
  });
});
