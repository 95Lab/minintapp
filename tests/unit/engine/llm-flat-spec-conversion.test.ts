import { describe, expect, it } from "vitest";
import { AppSpecSchema } from "@/engine/app-spec/app-spec-schema";
import { exampleClassDraw, exampleMilkTeaOrder, examplePasswordQuiz, exampleWorkshopVote } from "@/engine/app-spec/app-spec-examples";
import { appSpecToFlatSpec, flatSpecToAppSpec } from "@/engine/generation/llm-flat-spec-conversion";
import { FEW_SHOT_EXAMPLES } from "@/engine/generation/llm-few-shot-examples";
import { exampleExpenseByCategory } from "@/engine/app-spec/app-spec-examples-compose-summary";

describe("llm-flat-spec-conversion", () => {
  it.each([
    ["choice", exampleWorkshopVote],
    ["quiz", examplePasswordQuiz],
    ["collect", exampleMilkTeaOrder],
  ] as const)("round-trips a valid %s AppSpec through the flat wire shape", (_label, spec) => {
    const flat = appSpecToFlatSpec(spec);
    const roundTripped = flatSpecToAppSpec(flat);
    expect(roundTripped).toEqual(spec);
    expect(AppSpecSchema.safeParse(roundTripped).success).toBe(true);
  });

  it("converts a flat choice block, dropping the null quiz/collect fields", () => {
    const flat = appSpecToFlatSpec(exampleWorkshopVote);
    const block = flat.blocks[0];
    expect(block.type).toBe("choice");
    expect(block.questions).toBeNull();
    expect(block.fields).toBeNull();
    expect(block.leaderboard).toBeNull();

    const spec = flatSpecToAppSpec(flat);
    expect(spec.blocks[0].type).toBe("choice");
  });

  it("defaults missing/null optional fields on conversion back to AppSpec", () => {
    const flat = appSpecToFlatSpec(exampleWorkshopVote);
    const block = flat.blocks[0];
    if (block.type !== "choice") throw new Error("expected choice block");
    // Simulate a model omission: multi left null.
    const withNullMulti = { ...flat, blocks: [{ ...block, multi: null }] };
    const spec = flatSpecToAppSpec(withNullMulti);
    const choiceBlock = spec.blocks[0];
    expect(choiceBlock.type).toBe("choice");
    if (choiceBlock.type === "choice") expect(choiceBlock.multi).toBe(false);
  });

  it("converts a flat quiz block back into a valid AppSpec", () => {
    const flat = appSpecToFlatSpec(examplePasswordQuiz);
    const spec = flatSpecToAppSpec(flat);
    expect(AppSpecSchema.safeParse(spec).success).toBe(true);
    expect(spec.blocks[0].type).toBe("quiz");
  });

  it("converts a flat collect block back into a valid AppSpec", () => {
    const flat = appSpecToFlatSpec(exampleMilkTeaOrder);
    const spec = flatSpecToAppSpec(flat);
    expect(AppSpecSchema.safeParse(spec).success).toBe(true);
    if (spec.blocks[0].type === "collect") {
      expect(spec.blocks[0].fields.some((f) => f.options?.some((o) => o.unitPrice === 35000))).toBe(true);
    }
  });

  it("shows the model the summary example whole (its query fits the AI format, so no view is dropped)", () => {
    const source = exampleExpenseByCategory.blocks[0] as { views: unknown[] };
    const flat = appSpecToFlatSpec(exampleExpenseByCategory).blocks[0] as unknown as { views: unknown[] };
    expect(flat.views).toHaveLength(source.views.length);
    expect(JSON.stringify(FEW_SHOT_EXAMPLES)).toContain('"kind":"summary"');
    // and it comes back as the same query
    const back = AppSpecSchema.parse(flatSpecToAppSpec(appSpecToFlatSpec(exampleExpenseByCategory)));
    expect(JSON.stringify(back.blocks[0])).toEqual(JSON.stringify(AppSpecSchema.parse(exampleExpenseByCategory).blocks[0]));
  });

  it("fills harmless gaps small models leave: an untitled block takes the app title, an empty options wheel spins people", () => {
    const flat = appSpecToFlatSpec(exampleClassDraw);
    const block = { ...flat.blocks[0], title: "", source: "options", options: [] };
    const spec = AppSpecSchema.parse(flatSpecToAppSpec({ ...flat, title: "Lucky wheel", requireName: false, blocks: [block] }));
    expect(spec.blocks[0]).toMatchObject({ type: "wheel", title: "Lucky wheel", source: "participants" });
    // spinning among people needs their names
    expect(spec.requireName).toBe(true);
  });
});
