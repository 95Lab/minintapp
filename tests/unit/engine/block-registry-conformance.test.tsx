// Conformance: every registered brick and preset honours the whole contract, checked by iterating
// the registries rather than a hand-kept list. The fixture maps are typed by the registries' own
// keys, so registering a new brick or preset without a fixture fails the typecheck; an empty
// fixture list fails here. Each brick is walked end to end: spec → AI flat format → sample answers
// that pass validation → results for host and phone → remix summary → phishing texts → UI markup.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppSpecSchema, type AppSpecDraft } from "@/engine/app-spec/app-spec-schema";
import { exampleClassDraw, exampleMilkTeaOrder, exampleOneWordCloud, examplePasswordQuiz, exampleWorkshopVote } from "@/engine/app-spec/app-spec-examples";
import { exampleTravelRate, exampleWeekendTrip } from "@/engine/app-spec/app-spec-examples-live";
import { exampleTapSpeedGame } from "@/engine/app-spec/app-spec-examples-custom";
import { exampleSignupSlots, exampleTripSplit } from "@/engine/app-spec/app-spec-examples-compose";
import { exampleRandomTeams, exampleStepSurvey } from "@/engine/app-spec/app-spec-examples-compose-advanced";
import { exampleExpenseByCategory } from "@/engine/app-spec/app-spec-examples-compose-summary";
import { exampleQnaBoard } from "@/engine/app-spec/app-spec-examples-compose-board";
import { exampleChatRoom } from "@/engine/app-spec/app-spec-examples-compose-chat";
import { exampleWhereFrom } from "@/engine/app-spec/app-spec-examples-compose-map";
import { exampleSettleTrip } from "@/engine/app-spec/app-spec-examples-compose-settle";
import { examplePhotoContest } from "@/engine/app-spec/app-spec-examples-compose-photo";
import { exampleRankedChoice } from "@/engine/app-spec/app-spec-examples-compose-ranking";
import { exampleBuzzer } from "@/engine/app-spec/app-spec-examples-compose-buzzer";
import { stripPrivateFields } from "@/engine/app-spec/strip-private-fields";
import type { AnswerRow, AppRuntime } from "@/engine/blocks/block-definition-types";
import { BLOCK_REGISTRY, BLOCK_TYPES, blockDefinition, type Block, type BlockType } from "@/engine/blocks/block-registry";
import { vocabularyEntry } from "@/engine/blocks/block-vocabulary";
import { PRESET_REGISTRY, PRESET_TYPES, type PresetType } from "@/engine/blocks/presets/preset-registry";
import { blockUi } from "@/engine-ui/blocks/block-ui-registry";

const idle: AppRuntime = { openQuestionId: null, revealedQuestionIds: [] };

/** A spec using the brick, plus the runtime under which participants can answer it (open question, open step…). */
interface Fixture {
  draft: AppSpecDraft;
  live?: (block: Block) => AppRuntime;
  /** blocks that need real input sample people can't give (a photo upload): no sample answers expected */
  noSamples?: true;
}

const BRICK_FIXTURES: { [K in BlockType]: Fixture[] } = {
  compose: [
    { draft: exampleTripSplit },
    { draft: exampleSignupSlots },
    { draft: exampleRandomTeams },
    { draft: exampleExpenseByCategory },
    { draft: exampleQnaBoard },
    { draft: exampleChatRoom },
    { draft: exampleWhereFrom },
    { draft: exampleSettleTrip },
    { draft: examplePhotoContest, noSamples: true },
    { draft: exampleRankedChoice },
    {
      draft: exampleBuzzer,
      live: (b) => (b.type === "compose" ? { ...idle, blocks: { [b.id]: { step: { current: b.inputs[0].id, openedAt: Date.now(), done: [] }, teams: null } } } : idle),
    },
    {
      draft: exampleStepSurvey,
      live: (b) => (b.type === "compose" ? { ...idle, blocks: { [b.id]: { step: { current: b.inputs[0].id, openedAt: Date.now(), done: [] }, teams: null } } } : idle),
    },
  ],
  quiz: [{ draft: examplePasswordQuiz, live: (b) => (b.type === "quiz" ? { ...idle, openQuestionId: b.questions[0].id } : idle) }],
  wheel: [{ draft: exampleClassDraw }],
  custom: [{ draft: exampleTapSpeedGame }],
  live: [{ draft: exampleWeekendTrip }, { draft: exampleTravelRate }],
};

const PRESET_FIXTURES: { [K in PresetType]: AppSpecDraft } = {
  choice: exampleWorkshopVote,
  collect: exampleMilkTeaOrder,
  open_text: exampleOneWordCloud,
};

/** Deterministic [0,1) so sample answers are the same on every run. */
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const cases = BLOCK_TYPES.flatMap((type) =>
  BRICK_FIXTURES[type].flatMap(({ draft, live, noSamples }) => {
    const spec = AppSpecSchema.parse(structuredClone(draft));
    return spec.blocks.filter((b) => b.type === type).map((block) => ({ name: `${type} "${block.id}" (${draft.title})`, spec, block, runtime: live?.(block) ?? idle, noSamples: !!noSamples }));
  }),
);

describe("brick registry conformance", () => {
  it("has a fixture for every registered brick", () => {
    expect(BLOCK_TYPES.length).toBeGreaterThan(0);
    for (const type of BLOCK_TYPES) expect(cases.some((c) => c.block.type === type), type).toBe(true);
  });

  it.each(cases)("$name round-trips the AI flat format", ({ block }) => {
    const entry = vocabularyEntry(block.type);
    const def = blockDefinition(block.type);
    expect(def.specSchema.parse(entry.fromFlat({ ...entry.toFlat(block), id: block.id }))).toEqual(block);
  });

  it.each(cases)("$name: sample answers pass validation and give results for host and phone", ({ spec, block, runtime, noSamples }) => {
    const def = blockDefinition(block.type);
    const random = seeded(42);
    const answers: AnswerRow<unknown>[] = [];
    for (let p = 0; p < 4; p++) {
      const sample = def.sampleAnswer?.(block, runtime, random);
      if (!sample) continue;
      expect(def.payloadSchema.safeParse(sample.payload).success).toBe(true);
      expect(def.validate(block, sample.payload, { itemId: sample.itemId, runtime })).toBeNull();
      answers.push({ blockId: block.id, itemId: sample.itemId, participantHash: `${p}`.repeat(64).slice(0, 64), displayName: `Người ${p + 1}`, payload: sample.payload, createdAt: 1000 + p });
    }
    if (def.sampleAnswer && !noSamples) expect(answers.length, "sampleAnswer produced nothing under the live runtime").toBeGreaterThan(0);

    const host = def.computeResults(block, answers, { appStatus: "active", runtime, viewer: { isHost: true, participantHash: null } });
    const phone = def.computeResults(block, answers, { appStatus: "active", runtime, viewer: { isHost: false, participantHash: answers[0]?.participantHash ?? null } });
    expect(host).not.toBeNull();
    expect(phone).not.toBeNull();
    expect(typeof def.summarizeForRemix(block, host)).toBe("string");
    expect(def.security.allTexts(block).filter(Boolean).length).toBeGreaterThan(0);

    // UI: both screens render the public block with real results, never an empty fragment.
    const publicBlock = stripPrivateFields({ ...spec, blocks: [block] }, new Set(runtime.revealedQuestionIds)).blocks[0];
    const { Host, Participant } = blockUi(block.type);
    const hostHtml = renderToStaticMarkup(<Host appId="app1" block={publicBlock} results={host} runtime={runtime} locale="vi" busy={false} canControl onAction={() => {}} />);
    const phoneHtml = renderToStaticMarkup(<Participant appId="app1" displayName="An" block={publicBlock} results={phone} runtime={runtime} myAnswers={{}} open locale="vi" onSubmit={async () => true} />);
    expect(hostHtml.length).toBeGreaterThan(20);
    expect(phoneHtml.length).toBeGreaterThan(20);
    // No results yet (first paint) or an isolated failing block: both screens still render.
    expect(() => renderToStaticMarkup(<Host appId="app1" block={publicBlock} results={null} runtime={runtime} locale="vi" busy={false} canControl onAction={() => {}} />)).not.toThrow();
    expect(() => renderToStaticMarkup(<Participant appId="app1" displayName="An" block={publicBlock} results={null} runtime={runtime} myAnswers={{}} open locale="vi" onSubmit={async () => true} />)).not.toThrow();
  });

  it.each(cases)("$name hides private fields from participants without changing identity", ({ spec, block }) => {
    const pub = stripPrivateFields({ ...spec, blocks: [block] }, new Set()).blocks[0];
    expect(pub).toMatchObject({ type: block.type, id: block.id });
    if (block.type === "quiz") expect(JSON.stringify(pub)).not.toContain('"correct":"');
  });

  it("has one registry entry per type key", () => {
    for (const [key, def] of Object.entries(BLOCK_REGISTRY)) expect(def.type).toBe(key);
  });
});

describe("preset registry conformance", () => {
  it.each(PRESET_TYPES)("%s expands into a valid, non-empty runtime block and round-trips the AI flat format", (type) => {
    const draft = structuredClone(PRESET_FIXTURES[type]);
    const presetBlock = draft.blocks.find((b) => b.type === type);
    expect(presetBlock, `fixture for ${type} has no ${type} block`).toBeDefined();
    const def = PRESET_REGISTRY[type];
    const parsed = def.specSchema.parse(presetBlock);
    const expanded = def.expand(parsed as never);
    expect(blockDefinition(expanded.type).specSchema.safeParse(expanded).success).toBe(true);
    expect(expanded.type === "compose" && expanded.inputs.length + expanded.views.length).toBeGreaterThan(0);
    const entry = vocabularyEntry(type);
    expect(def.specSchema.parse(entry.fromFlat({ ...entry.toFlat(parsed as never), id: parsed.id }))).toEqual(parsed);
  });
});
