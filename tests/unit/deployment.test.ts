import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requireSameOrigin, secureHostCookie } from "@/lib/host/host-session";
const oldImage = `ghcr.io/example/app@sha256:${"a".repeat(64)}`;
const newImage = `ghcr.io/example/app@sha256:${"b".repeat(64)}`;
const dirs: string[] = [];
afterEach(() => { vi.unstubAllEnvs(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function runDeploy(options: { previous?: boolean; failUp?: boolean; failPull?: boolean; failCurl?: boolean; image?: string } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "minint-deploy-")); dirs.push(dir);
  const bin = join(dir, "bin"); mkdirSync(bin);
  copyFileSync("deploy/deploy.sh", join(dir, "deploy.sh"));
  writeFileSync(join(dir, "network-preflight.py"), "# Network preflight is tested separately on the target host.\n");
  writeFileSync(join(dir, ".env"), "APP_ORIGIN=https://app.example.com\n");
  writeFileSync(join(dir, ".env.app"), "");
  if (options.previous) writeFileSync(join(dir, ".image.env"), `MININTAPP_IMAGE=${oldImage}\n`);
  writeFileSync(join(bin, "flock"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  writeFileSync(join(bin, "docker"), `#!/bin/bash
printf '%s\\n' "$*" >> "$DEPLOY_TEST_LOG"
if [[ "$*" == *"pull app"* && "$FAIL_PULL" == 1 ]]; then exit 1; fi
if [[ "$*" == *".image.next."* && "$*" == *"up -d"* && "$FAIL_UP" == 1 ]]; then exit 1; fi
exit 0
`, { mode: 0o755 });
  writeFileSync(join(bin, "curl"), "#!/bin/sh\nif [ \"$FAIL_CURL\" = 1 ]; then exit 1; fi\nprintf '%s' '{\"service\":\"minintapp\"}'\n", { mode: 0o755 });
  const result = spawnSync("bash", [join(dir, "deploy.sh"), options.image ?? newImage], { encoding: "utf8", env: {
    ...process.env, PATH: `${bin}:${process.env.PATH}`, DEPLOY_TEST_LOG: join(dir, "docker.log"),
    FAIL_UP: options.failUp ? "1" : "0", FAIL_PULL: options.failPull ? "1" : "0", FAIL_CURL: options.failCurl ? "1" : "0",
  } });
  return { result, dir, log: existsSync(join(dir, "docker.log")) ? readFileSync(join(dir, "docker.log"), "utf8") : "" };
}
describe("deployment control flow with stubbed Docker/curl", () => {
  it.each(["whoami", "deploy ghcr.io/95lab/minintapp:latest", `deploy ghcr.io/other/app@sha256:${"a".repeat(64)}`])("rejects unauthorized SSH command %s", (command) => {
    const result = spawnSync("bash", ["deploy/ssh-gate.sh", command], { encoding: "utf8", input: "" });
    expect(result.status).toBe(64);
  });
  it("promotes a successful immutable image and retains the previous reference", () => {
    const { result, dir, log } = runDeploy({ previous: true });
    expect(result.status).toBe(0);
    expect(readFileSync(join(dir, ".image.env"), "utf8")).toContain(newImage);
    expect(readFileSync(join(dir, ".image.previous.env"), "utf8")).toContain(oldImage);
    expect(log).toContain("pull app");
    expect(log).not.toContain("proxy");
  });
  it.each([{ failUp: true }, { failCurl: true }])("rolls back on startup or public smoke failure", (failure) => {
    const { result, dir, log } = runDeploy({ previous: true, ...failure });
    expect(result.status).toBe(1);
    expect(readFileSync(join(dir, ".image.env"), "utf8")).toContain(oldImage);
    expect(log).toContain("--env-file .image.env -f compose.yml -p minintapp up -d");
  });
  it("does not replace the running stack if pull fails", () => {
    const { result, log } = runDeploy({ previous: true, failPull: true });
    expect(result.status).toBe(1);
    expect(log).not.toContain("up -d");
  });
  it("stops a failed first deployment without inventing a rollback", () => {
    const { result, dir, log } = runDeploy({ failUp: true });
    expect(result.status).toBe(1);
    expect(existsSync(join(dir, ".image.env"))).toBe(false);
    expect(log).toContain("stop app");
  });
  it("rejects mutable tags before doing anything", () => {
    const { result, log } = runDeploy({ image: "ghcr.io/example/app:latest" });
    expect(result.status).toBe(1); expect(log).toBe("");
  });
});
it("uses the configured HTTPS origin behind the reverse proxy", () => {
  vi.stubEnv("APP_ORIGIN", "https://app.example.com");
  const proxied = new Request("http://app:3000/api/apps/from-template", { headers: { origin: "https://app.example.com", host: "app.example.com" } });
  expect(() => requireSameOrigin(proxied)).not.toThrow();
  expect(secureHostCookie(proxied)).toBe(true);
  expect(() => requireSameOrigin(new Request("http://app:3000", { headers: { origin: "https://other.example.com" } }))).toThrow("forbidden");
});
