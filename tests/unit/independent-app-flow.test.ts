import { afterEach, expect, it, vi } from "vitest";
import { APP_TEMPLATES } from "@/engine/templates/app-templates";
import { AppSpecSchema } from "@/engine/app-spec/app-spec-schema";
import { RuntimeSeedSchema } from "../../platform/contracts";
import { RuntimeSnapshotSchema } from "@/lib/runtime-plane/snapshot-schema";
import { initialRuntime } from "@/lib/blocks/block-definition-types";
import { runtimePublicUrl } from "@/lib/runtime-plane/public-url";
import { blockDefinition } from "@/engine/blocks/block-registry";
const { deployment, redirect } = vi.hoisted(() => ({ deployment: vi.fn(), redirect: vi.fn() }));
vi.mock("../../platform/store", () => ({ deployment, pool: {} }));
vi.mock("next/navigation", () => ({ redirect }));
import { redirectManagedParticipant } from "@/lib/control-plane/participant-redirect";
import { buildSpec } from "../../platform/build-spec";
const id = "a".repeat(24), child = "b".repeat(24);
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it.each(APP_TEMPLATES.flatMap(template => (["vi", "en"] as const).map(locale => ({ template, locale }))))(
  "packages $template.id ($locale) without losing any runtime capabilities or submitted values",
  async ({ template, locale }) => {
    const spec = AppSpecSchema.parse(template.spec[locale]);
    const built = await buildSpec({ spec, engine: true, prompt: template.title[locale], lifetime: "1h" });
    const seed = RuntimeSeedSchema.parse({ id, ...built, prompt: "template", hostTokenHash: "a".repeat(64), ownerId: null, parentId: null, createdAt: Date.now(), expiresAt: Date.now() + 3600000 });
    expect(seed.spec).toEqual(spec);
    const runtime = initialRuntime();
    const responses = spec.blocks.flatMap(block => {
      const sample = blockDefinition(block.type).sampleAnswer?.(block, runtime, () => 0.5);
      return sample ? [{ ...sample, blockId: block.id, participantHash: "b".repeat(64), displayName: "Lan", createdAt: Date.now() }] : [];
    });
    const snapshot = { app: { ...seed, status: "active", stateVersion: 1, runtime, parentId: null, movedTo: null, endedAt: null, announcement: null }, responses };
    expect(RuntimeSnapshotSchema.parse(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
  },
);

it("uses each runtime's own origin and resolves remix to a sibling without platform credentials", () => {
  vi.stubEnv("PLATFORM_ROLE", "control"); vi.stubEnv("APPS_DOMAIN", "apps.example.test");
  expect(runtimePublicUrl(id)).toBe(`https://${id}.apps.example.test/rooms/${id}`);
  vi.stubEnv("PLATFORM_ROLE", "runtime"); vi.stubEnv("RUNTIME_APP_ID", id);
  vi.stubEnv("APP_ORIGIN", `https://${id}.apps.example.test`);
  expect(runtimePublicUrl(child)).toBe(`https://${child}.apps.example.test/rooms/${child}`);
  expect(runtimePublicUrl("//evil.test")).toBeUndefined();
  vi.stubEnv("APP_ORIGIN", "https://dashboard.example.test");
  expect(runtimePublicUrl(child)).toBeUndefined();
  vi.stubEnv("PLATFORM_ROLE", "standalone");
  expect(runtimePublicUrl(id)).toBeUndefined();
});
it("redirects old participant links only after the correct runtime is healthy and running", async () => {
  vi.stubEnv("PLATFORM_ROLE", "control"); vi.stubEnv("APPS_DOMAIN", "apps.example.test");
  for (const state of ["QUEUED", "GENERATING", "BUILDING", "DEPLOYING", "FAILED", "SUSPENDED", "EXPIRED", "DELETED"]) {
    deployment.mockResolvedValue({ state, hostname: `${id}.apps.example.test`, expires_at: new Date(Date.now()+60000) });
    await redirectManagedParticipant(id);
  }
  expect(redirect).not.toHaveBeenCalled();
  deployment.mockResolvedValue({ state: "RUNNING", hostname: "other.example.test", expires_at: new Date(Date.now()+60000) });
  await redirectManagedParticipant(id); expect(redirect).not.toHaveBeenCalled();
  deployment.mockResolvedValue({ state: "RUNNING", hostname: `${id}.apps.example.test`, expires_at: new Date(Date.now()-1) });
  await redirectManagedParticipant(id); expect(redirect).not.toHaveBeenCalled();
  deployment.mockResolvedValue({ state: "RUNNING", hostname: `${id}.apps.example.test`, expires_at: new Date(Date.now()+60000) });
  await redirectManagedParticipant(id);
  expect(redirect).toHaveBeenCalledExactlyOnceWith(runtimePublicUrl(id));
});
it("serves an independent runtime without consulting the control plane", async () => {
  vi.stubEnv("PLATFORM_ROLE", "runtime");
  await redirectManagedParticipant(id);
  expect(deployment).not.toHaveBeenCalled(); expect(redirect).not.toHaveBeenCalled();
});
