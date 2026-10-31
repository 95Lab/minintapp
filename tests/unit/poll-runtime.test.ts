import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { PollRepository } from "../../runtime/poll/repository";
import { createPollHandler } from "../../runtime/poll/server";
import { pollManifest } from "../support/poll-runtime-fixtures";
import { PollRuntimeStateSchema } from "@/lib/api/poll-runtime-contract";

describe("standalone poll SQLite repository", () => {
  it("upserts one vote per participant, persists through restart and isolates data volumes", () => {
    const dir = mkdtempSync(join(tmpdir(), "minint-poll-"));
    const manifest = pollManifest(); const path = join(dir, "poll.sqlite");
    let repo = new PollRepository(path, manifest);
    try {
      repo.vote("first", { optionId: "tea" }); repo.vote("second", { optionId: "coffee" }); repo.vote("first", { optionId: "coffee" });
      expect(repo.state("first").results).toEqual({ total: 2, counts: { tea: 0, coffee: 2 } });
      expect(repo.state("first").myOptionId).toBe("coffee");
      repo.action("close"); repo.close(); repo = new PollRepository(path, manifest);
      expect(repo.state("first").status).toBe("closed");
      expect(repo.state("second").results?.total).toBe(2);
      expect(() => repo.vote("first", { optionId: "tea" })).toThrow("closed");
      repo.action("reopen"); repo.vote("first", { optionId: "tea" });
      expect(repo.state("first").results?.counts.tea).toBe(1);
      const other = new PollRepository(join(dir, "other.sqlite"), pollManifest({ deploymentId: "e".repeat(24) }));
      try { expect(other.state("first").myOptionId).toBeNull(); expect(other.state(null).results?.total).toBe(0); } finally { other.close(); }
      expect(() => new PollRepository(path, { ...manifest, deploymentId: "e".repeat(24) })).toThrow("runtime_volume_mismatch");
    } finally { repo.close(); rmSync(dir, { recursive: true, force: true }); }
  });
  it.each(["after_submit", "after_close", "host"] as const)("enforces %s visibility on server, including hidden totals", visibility => {
    const repo = new PollRepository(":memory:", pollManifest({ resultsVisibility: visibility }));
    try {
      expect(repo.state(null).results).toBeNull(); repo.vote("one", { optionId: "tea" });
      expect(repo.state("two").results).toBeNull();
      expect(repo.state("one").results !== null).toBe(visibility === "after_submit");
      expect(repo.state(null, true).results?.total).toBe(1);
      repo.action("close");
      expect(repo.state(null).results !== null).toBe(visibility === "after_close");
      repo.action("end"); expect(() => repo.state(null)).toThrow("ended");
      expect(repo.health().ended).toBe(true);
    } finally { repo.close(); }
  });
  it("rejects expiry at the exact boundary, invalid votes and missing names", () => {
    let now = 1000; const repo = new PollRepository(":memory:", pollManifest({ expiresAt: 2000, requireName: true }), () => now);
    try {
      expect(() => repo.vote("one", { optionId: "bad", displayName: "Lan" })).toThrow("invalid_vote");
      expect(() => repo.vote("one", { optionId: "tea" })).toThrow("name_required");
      repo.vote("one", { optionId: "tea", displayName: "Lan" });
      expect(repo.state("two")).not.toHaveProperty("participants");
      now = 2000;
      expect(() => repo.vote("two", { optionId: "coffee", displayName: "An" })).toThrow("expired");
      expect(() => repo.action("reopen")).toThrow("expired"); expect(() => repo.state(null)).toThrow("expired");
      expect(repo.health().expired).toBe(true);
    } finally { repo.close(); }
  });
  it("end removes ballots permanently across restart", () => {
    const dir = mkdtempSync(join(tmpdir(), "minint-end-")); const path = join(dir, "poll.sqlite"); const manifest = pollManifest();
    let repo = new PollRepository(path, manifest);
    try {
      repo.vote("one", { optionId: "tea" }); repo.action("end"); repo.close(); repo = new PollRepository(path, manifest);
      expect(repo.health().ended).toBe(true); expect(() => repo.action("reopen")).toThrow("ended");
      // Inspect the actual file rather than relying on state(), which correctly hides ended data.
      const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
      const db = new DatabaseSync(path); try { expect(db.prepare("SELECT count(*) AS n FROM votes").get()).toMatchObject({ n: 0 }); } finally { db.close(); }
    } finally { repo.close(); rmSync(dir, { recursive: true, force: true }); }
  });
});

describe("standalone HTTP contract", () => {
  it("uses host-scoped HttpOnly cookies, protects host actions and does not disclose private config", async () => {
    const repo = new PollRepository(":memory:", pollManifest({ resultsVisibility: "host" }));
    const hostToken = randomBytes(32).toString("hex");
    const handle = createPollHandler({ repository: repo, hostToken, assets: { html: "<main>Poll</main>", js: "", css: "" } });
    const request = (path: string, init: RequestInit = {}) => handle(new Request(`https://${repo.manifest.hostname}${path}`, init));
    try {
      const response = await request("/api/state");
      expect(response.headers.get("set-cookie")).toMatch(/^__Host-minint_poll=[a-f0-9]{64}; Path=\/; HttpOnly; SameSite=Strict; Secure$/);
      expect(response.headers.get("set-cookie")).not.toMatch(/Domain=/);
      const cookie = response.headers.get("set-cookie")!.split(";")[0];
      const state = await response.json(); expect(PollRuntimeStateSchema.safeParse(state).success).toBe(true);
      expect(state.results).toBeNull(); expect(JSON.stringify(state)).not.toMatch(/hostToken|specHash|deploymentId/);
      const post = (path: string, data: unknown, extra: Record<string,string> = {}) => request(path, { method: "POST", headers: { "content-type": "application/json", origin: `https://${repo.manifest.hostname}`, cookie, ...extra }, body: JSON.stringify(data) });
      expect((await post("/api/votes", { optionId: "tea" }, { origin: "https://evil.example" })).status).toBe(403);
      expect((await post("/api/votes", { optionId: "tea" })).status).toBe(200);
      expect((await post("/api/host", { action: "close" })).status).toBe(403);
      expect((await post("/api/host", { action: "close" }, { authorization: "Bearer incorrect" })).status).toBe(403);
      const host = await post("/api/host", { action: "close" }, { authorization: `Bearer ${hostToken}` });
      expect(host.status).toBe(200); expect((await host.json()).results.total).toBe(1);
      expect((await post("/api/votes", { optionId: "coffee" })).status).toBe(409);
      expect((await request("/api/state", { headers: { host: "wrong.example", "x-forwarded-host": repo.manifest.hostname } })).status).toBe(421);
      expect((await request("/", { headers: { host: "wrong.example" } })).status).toBe(421);
      expect((await request("/")).headers.get("content-security-policy")).toContain("script-src 'self'");
      expect((await request("/health")).status).toBe(200);
      expect((await post("/api/votes", { optionId: "tea", unexpected: "value" })).status).toBe(400);
      expect((await post("/api/votes", { optionId: "tea", displayName: "x".repeat(5000) })).status).toBe(413);
      expect((await request("/api/votes", { method: "POST", headers: { origin: `https://${repo.manifest.hostname}`, cookie }, body: "x" })).status).toBe(415);
    } finally { repo.close(); }
  });
  it("does not accept a remote origin as local development or an invalid host key", () => {
    const repo = new PollRepository(":memory:", pollManifest());
    try {
      const base = { repository: repo, hostToken: randomBytes(32).toString("hex"), assets: { html: "", js: "", css: "" } };
      expect(() => createPollHandler({ ...base, localOrigin: "http://0.0.0.0:3000" })).toThrow("invalid_local_origin");
      expect(() => createPollHandler({ ...base, hostToken: "weak" })).toThrow("invalid_runtime_host_token");
    } finally { repo.close(); }
  });
});
