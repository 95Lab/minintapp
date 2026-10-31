import { describe, expect, it } from "vitest";
import { AppSpecSchema, MAX_BLOCKS } from "@/engine/app-spec/app-spec-schema";
import { exampleWorkshopVote } from "@/engine/app-spec/app-spec-examples";
import { exampleWorkshopDay, exampleWorkshopDayEn } from "@/engine/app-spec/app-spec-examples-pages";
import { appSpecToFlatSpec, flatSpecToAppSpec } from "@/engine/generation/llm-flat-spec-conversion";
import { llmOutputWireSchema } from "@/engine/generation/llm-output-wire-schema";
import { LLM_OUTPUT_JSON_SCHEMA } from "@/engine/generation/llm-output-json-schema";
import { blocksWithOpenStep, blockTabLabel, hashBlockId } from "@/engine-ui/app-pages-tabs";

const withBlocks = (n: number) => ({
  ...exampleWorkshopVote,
  blocks: Array.from({ length: n }, (_, i) => ({ ...exampleWorkshopVote.blocks[0], id: `poll-${i}` })),
});

describe("multi-page apps", () => {
  it("a spec stored without `layout` loads as a stack", () => {
    expect("layout" in exampleWorkshopVote).toBe(false);
    const parsed = AppSpecSchema.parse(exampleWorkshopVote);
    expect(parsed.layout).toBe("stack");
  });

  it("accepts up to 6 blocks and rejects 7", () => {
    expect(MAX_BLOCKS).toBe(6);
    expect(AppSpecSchema.safeParse(withBlocks(6)).success).toBe(true);
    expect(AppSpecSchema.safeParse(withBlocks(7)).success).toBe(false);
  });

  it("rejects an unknown layout", () => {
    expect(AppSpecSchema.safeParse({ ...exampleWorkshopVote, layout: "carousel" }).success).toBe(false);
  });

  it.each([exampleWorkshopDay, exampleWorkshopDayEn])("the workshop-day example is a valid tabs app", (draft) => {
    const parsed = AppSpecSchema.parse(draft);
    expect(parsed.layout).toBe("tabs");
    expect(parsed.blocks).toHaveLength(4);
  });

  it("round-trips layout through the LLM wire shape; null/missing means stack", () => {
    const flat = appSpecToFlatSpec(exampleWorkshopDay);
    expect(flat.layout).toBe("tabs");
    expect(flatSpecToAppSpec(flat).layout).toBe("tabs");
    expect(AppSpecSchema.parse(flatSpecToAppSpec({ ...appSpecToFlatSpec(exampleWorkshopVote), layout: null })).layout).toBe("stack");
    // the wire parser accepts the field, a null, and its absence (older few-shot output)
    const wire = (layout?: unknown) => llmOutputWireSchema.safeParse({ outcome: "ok", spec: { ...appSpecToFlatSpec(exampleWorkshopDay), layout }, suggestion: null, riskFlags: ["none"] });
    expect(wire("tabs").success).toBe(true);
    expect(wire(null).success).toBe(true);
    expect(wire(undefined).success).toBe(true);
    expect(wire("grid").success).toBe(false);
  });

  it("asks the model for `layout` in the strict JSON schema", () => {
    const spec = (LLM_OUTPUT_JSON_SCHEMA.properties as Record<string, { anyOf: { required: string[] }[] }>).spec.anyOf[0];
    expect(spec.required).toContain("layout");
  });

  it("labels tabs by block title and flags a block with an open quiz question", () => {
    const parsed = AppSpecSchema.parse(exampleWorkshopDay);
    expect(parsed.blocks.map(blockTabLabel)).toEqual(["Chủ đề chiều nay", "Hỏi đáp", "Đánh giá", "Trò chuyện"]);
    expect(blocksWithOpenStep(parsed.blocks, { openQuestionId: null, revealedQuestionIds: [] }).size).toBe(0);
  });
});

describe("tab hash parsing", () => {
  const blocks = exampleWorkshopDay.blocks.map((b) => ({ ...b })) as unknown as Parameters<typeof hashBlockId>[0];
  const firstId = (blocks[0] as { id: string }).id;

  it("finds a block named by the hash, plain or percent-encoded", () => {
    expect(hashBlockId(blocks, `#${firstId}`)).toBe(firstId);
    expect(hashBlockId(blocks, `#${encodeURIComponent(firstId)}`)).toBe(firstId);
  });
  it("ignores an unknown id, an empty hash and the host token", () => {
    expect(hashBlockId(blocks, "#nope")).toBeNull();
    expect(hashBlockId(blocks, "")).toBeNull();
    expect(hashBlockId(blocks, "#k=abcdefgh")).toBeNull();
  });
  it("never throws on a malformed escape", () => {
    for (const hash of ["#%E0", "#%", "#%E0%A4%A", "#%zz", "#\uD800"]) expect(() => hashBlockId(blocks, hash)).not.toThrow();
    expect(hashBlockId(blocks, "#%E0")).toBeNull();
  });
});
