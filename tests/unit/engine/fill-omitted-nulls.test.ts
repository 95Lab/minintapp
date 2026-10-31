// A model that leaves out null fields (as the compact few-shot examples do) must parse exactly like
// one that writes them: filling omitted nulls from the output schema restores the full shape.
import { describe, expect, it } from "vitest";
import { fillOmittedNulls } from "@/engine/generation/fill-omitted-nulls";
import { withoutNulls } from "@/engine/generation/json-without-nulls";
import { FEW_SHOT_EXAMPLES } from "@/engine/generation/llm-few-shot-examples";
import { LLM_OUTPUT_JSON_SCHEMA } from "@/engine/generation/llm-output-json-schema";
import { llmOutputWireSchema } from "@/engine/generation/llm-output-wire-schema";

describe("fillOmittedNulls", () => {
  it.each(FEW_SHOT_EXAMPLES.map((e) => [e.userPrompt.slice(0, 40), e.output] as const))("restores every example with its nulls left out: %s", (_name, output) => {
    const compact = withoutNulls(output);
    expect(fillOmittedNulls(compact, LLM_OUTPUT_JSON_SCHEMA)).toEqual(output);
    expect(llmOutputWireSchema.safeParse(fillOmittedNulls(compact, LLM_OUTPUT_JSON_SCHEMA)).success).toBe(true);
  });

  it("fills only keys whose schema allows null; real mistakes stay for validation to report", () => {
    const out = fillOmittedNulls({ outcome: "ok", spec: { locale: "vi", blocks: [{ type: "choice", id: "x" }] } }, LLM_OUTPUT_JSON_SCHEMA) as {
      suggestion: unknown;
      riskFlags?: unknown;
      spec: { title?: unknown; description: unknown; blocks: Array<Record<string, unknown>> };
    };
    expect(out.suggestion).toBeNull();
    expect(out.spec.description).toBeNull();
    expect(out.spec.blocks[0].question).toBeNull();
    // not nullable → still missing → the wire parse names it
    expect(out.riskFlags).toBeUndefined();
    expect(out.spec.title).toBeUndefined();
    expect(llmOutputWireSchema.safeParse(out).success).toBe(false);
  });
});
