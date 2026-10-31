import { describe, expect, it } from "vitest";
import { composeSpec } from "@/lib/app-spec/app-spec-examples";
import { AppSpecSchema } from "@/engine/app-spec/app-spec-schema";
import { exampleWorkshopVote } from "@/engine/app-spec/app-spec-examples";
import { createDeployment } from "@/lib/deployments/deployment-state";
import { createPollRuntimeManifest, runtimeSpecHash } from "@/lib/deployments/poll-runtime-manifest";
import { deploymentInput } from "../support/deployment-fixtures";

describe("locked AppSpec to independent runtime manifest", () => {
  it("projects supported poll without credentials and hashes normalized spec deterministically", () => {
    const spec = AppSpecSchema.parse(composeSpec());
    const d = createDeployment(deploymentInput({ specHash: runtimeSpecHash(spec) }), Date.now());
    const manifest = createPollRuntimeManifest(spec, d);
    expect(manifest).toMatchObject({ appId: d.appId, deploymentId: d.id, templateVersion: "poll-v1", question: "Đồ uống", resultsVisibility: "everyone" });
    expect(manifest.options).toEqual([{ id: "tea", label: "Trà" }, { id: "coffee", label: "Cà phê" }]);
    expect(JSON.stringify(manifest)).not.toMatch(/hostToken|correct|prompt|idempotencyKey/);
    expect(runtimeSpecHash(spec)).toBe(runtimeSpecHash({ ...spec, title: spec.title }));
    expect(runtimeSpecHash(spec)).not.toBe(runtimeSpecHash({ ...spec, title: "Changed" }));
    expect(() => createPollRuntimeManifest({ ...spec, title: "Changed" }, d)).toThrow("poll_snapshot_mismatch");
    expect(() => createPollRuntimeManifest(spec, { ...d, templateVersion: "quiz-v1" })).toThrow("poll_snapshot_mismatch");
  });
  it("accepts expanded choice presets and preserves result visibility", () => {
    const spec = AppSpecSchema.parse(exampleWorkshopVote);
    const d = createDeployment(deploymentInput({ specHash: runtimeSpecHash(spec) }), Date.now());
    expect(createPollRuntimeManifest(spec, d).resultsVisibility).toBe("after_submit");
  });
  it("refuses unsupported input behavior rather than silently dropping it", () => {
    const base = AppSpecSchema.parse(composeSpec());
    const spec = structuredClone(base); const block = spec.blocks[0]; if (block.type !== "compose") throw Error();
    block.inputs[0].multi = true;
    const d = createDeployment(deploymentInput({ specHash: runtimeSpecHash(spec) }), Date.now());
    expect(() => createPollRuntimeManifest(spec, d)).toThrow("unsupported_poll_spec");
    const many = AppSpecSchema.parse({ ...base, blocks: [...base.blocks, { ...base.blocks[0], id: "second" }] });
    expect(() => createPollRuntimeManifest(many, createDeployment(deploymentInput({ specHash: runtimeSpecHash(many) }), Date.now()))).toThrow("unsupported_poll_spec");
  });
});
