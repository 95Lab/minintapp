// Brick registry + preset vocabulary contract, the wheel brick, word-cloud filters, templates, and the
// generic block-action route (called for real, in memory mode).
import { beforeEach, describe, expect, it } from "vitest";
import { AppSpecSchema } from "@/engine/app-spec/app-spec-schema";
import { exampleClassDraw, exampleMilkTeaOrder, exampleOneWordCloud, examplePasswordQuiz, exampleWorkshopVote } from "@/engine/app-spec/app-spec-examples";
import { BLOCK_REGISTRY, BLOCK_TYPES } from "@/engine/blocks/block-registry";
import type { AppRuntime } from "@/engine/blocks/block-definition-types";
import { MERGED_LLM_FIELDS } from "@/engine/blocks/block-llm-fields";
import { wheelBlock, type WheelBlock } from "@/engine/blocks/wheel/wheel-block";
import { isBlockedAnswer, wordCloud } from "@/engine/blocks/compose/text-answer-filters";
import { PRESET_TYPES } from "@/engine/blocks/presets/preset-registry";
import { VOCABULARY_TYPES } from "@/engine/blocks/block-vocabulary";
import { runtimeSpec } from "./runtime-spec-test-helper";
import { appSpecToFlatSpec, flatSpecToAppSpec } from "@/engine/generation/llm-flat-spec-conversion";
import { GENERATION_SYSTEM_PROMPT } from "@/engine/generation/system-prompt-vi-en";
import { APP_TEMPLATES } from "@/engine/templates/app-templates";
import { appsRepository, participantHashFor, resetMemoryStore } from "@/engine/db/apps-repository";
import { POST as blockAction } from "@/app/api/engine/apps/[id]/block-action/route";
import { POST as fromTemplate } from "@/app/api/engine/apps/from-template/route";

const runtime: AppRuntime = { openQuestionId: null, revealedQuestionIds: [] };
const ctx = { appStatus: "active" as const, runtime, viewer: { isHost: true, participantHash: null } };
const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => resetMemoryStore());

describe("brick registry", () => {
  it("every registered brick declares its own type", () => {
    for (const type of BLOCK_TYPES) expect(BLOCK_REGISTRY[type].type).toBe(type);
  });

  it("merges AI fields without conflicts and describes every brick to the model", () => {
    expect(Object.keys(MERGED_LLM_FIELDS)).toEqual(expect.arrayContaining(["question", "options", "questions", "fields", "source", "maxWords"]));
    for (const type of VOCABULARY_TYPES) expect(GENERATION_SYSTEM_PROMPT).toContain(`${type} —`);
  });

  it("offers presets to the model but never stores them", () => {
    expect(VOCABULARY_TYPES.slice(0, PRESET_TYPES.length)).toEqual(PRESET_TYPES);
    for (const type of PRESET_TYPES) expect(BLOCK_TYPES as string[]).not.toContain(type);
  });

  it.each([exampleWorkshopVote, examplePasswordQuiz, exampleMilkTeaOrder, exampleClassDraw, exampleOneWordCloud])("round-trips $title through the flat AI format and expands to a runtime spec", (spec) => {
    expect(flatSpecToAppSpec(appSpecToFlatSpec(spec))).toEqual(spec);
    const stored = AppSpecSchema.parse(spec);
    expect(stored.blocks.every((b) => (BLOCK_TYPES as string[]).includes(b.type))).toBe(true);
  });
});

describe("wheel brick", () => {
  const prizes: WheelBlock = { type: "wheel", id: "w", title: "Quay", source: "options", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }], removeWinner: true };

  it("requires ≥2 options unless it draws participants", () => {
    expect(AppSpecSchema.safeParse({ ...exampleClassDraw, blocks: [{ ...prizes, options: [{ id: "a", label: "A" }] }] }).success).toBe(false);
    expect(AppSpecSchema.safeParse(exampleClassDraw).success).toBe(true);
  });

  it("spins server-side, removes winners, and refuses when the pool is empty", () => {
    let rt = runtime;
    const picked: string[] = [];
    for (let i = 0; i < 3; i++) {
      const res = wheelBlock.hostActions!.spin(prizes, rt, { args: {}, random: () => 0, answers: [] });
      expect(res.ok).toBe(true);
      if (res.ok) rt = res.runtime;
      picked.push(wheelBlock.computeResults(prizes, [], { ...ctx, runtime: rt })!.spins.at(-1)!.entryId);
    }
    expect(new Set(picked).size).toBe(3);
    expect(wheelBlock.hostActions!.spin(prizes, rt, { args: {}, random: () => 0, answers: [] }).ok).toBe(false);
    const reset = wheelBlock.hostActions!.reset(prizes, rt, { args: {}, random: Math.random, answers: [] });
    expect(reset.ok && wheelBlock.computeResults(prizes, [], { ...ctx, runtime: reset.runtime })!.entries.length).toBe(3);
  });

  it("draws among joined participants by display name", () => {
    const draw = exampleClassDraw.blocks[0] as WheelBlock;
    const answers = ["Lan", "Minh"].map((name, i) => ({ blockId: "draw", itemId: "", participantHash: `hash-${i}-0123456789abcdef`, displayName: name, payload: { kind: "wheel" as const, join: true as const }, createdAt: i }));
    const res = wheelBlock.hostActions!.spin(draw, runtime, { args: {}, random: () => 0.99, answers });
    expect(res.ok && wheelBlock.computeResults(draw, answers, { ...ctx, runtime: res.runtime })!.spins[0].label).toBe("Minh");
  });
});

describe("text answer filters (word clouds)", () => {
  it("groups answers case-insensitively and filters profanity from the projector", () => {
    const cloud = wordCloud(["Vui", "vui ", "Hữu ích", "vcl", "Vui"]);
    expect(cloud[0]).toEqual({ text: "Vui", count: 3 });
    expect(cloud.some((w) => isBlockedAnswer(w.text))).toBe(false);
  });
});

describe("templates", () => {
  it("have unique ids and valid VI + EN specs", () => {
    expect(new Set(APP_TEMPLATES.map((t) => t.id)).size).toBe(APP_TEMPLATES.length);
    for (const t of APP_TEMPLATES) {
      expect(AppSpecSchema.safeParse(t.spec.vi).success).toBe(true);
      expect(AppSpecSchema.safeParse(t.spec.en).success).toBe(true);
      expect(t.spec.en.locale).toBe("en");
    }
  });

  it("create an app instantly through the route", async () => {
    const started = Date.now();
    const res = await fromTemplate(json({ templateId: "prize-wheel", locale: "en", lifetime: "1h" }));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Date.now() - started).toBeLessThan(500);
    expect((await appsRepository().findApp(body.id))?.spec.blocks[0].type).toBe("wheel");
    expect((await fromTemplate(json({ templateId: "nope", locale: "vi", lifetime: "1h" }))).status).toBe(400);
  });
});

describe("block-action route", () => {
  it("spins a wheel for the host only, and rejects unknown actions", async () => {
    const { app, hostToken } = await appsRepository().createApp({ spec: runtimeSpec(exampleClassDraw), prompt: "p", lifetimeMs: 3_600_000 });
    await appsRepository().submitResponse(app.id, { blockId: "draw", itemId: "", participantHash: participantHashFor(app.id, "tok-aaaaaaaaaaaaaaaa"), displayName: "Lan", payload: { kind: "wheel", join: true } });

    expect((await blockAction(json({ blockId: "draw", action: "spin" }), params(app.id))).status).toBe(403);
    expect((await blockAction(json({ blockId: "draw", action: "explode" }, { "x-host-token": hostToken }), params(app.id))).status).toBe(400);

    const ok = await blockAction(json({ blockId: "draw", action: "spin" }, { "x-host-token": hostToken }), params(app.id));
    expect(ok.status).toBe(200);
    const state = await ok.json();
    expect(state.results[0].spins[0].label).toBe("Lan");
    expect(state.results[0].entries).toHaveLength(0); // removeWinner
  });

  it("drives the quiz (open/reveal) through the same route", async () => {
    const { app, hostToken } = await appsRepository().createApp({ spec: runtimeSpec(examplePasswordQuiz), prompt: "p", lifetimeMs: 3_600_000 });
    const res = await blockAction(json({ blockId: "quiz", action: "open", args: { questionId: "q1" } }, { "x-host-token": hostToken }), params(app.id));
    expect((await res.json()).runtime.openQuestionId).toBe("q1");
  });
});
