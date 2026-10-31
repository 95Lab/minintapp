import { describe, expect, it } from "vitest";
import { composeSpec } from "@/lib/app-spec/app-spec-examples";
import { templateSpec } from "@/lib/templates/app-templates";
import { validateRunnableSpec } from "@/lib/generation/runnable-spec";
import { GenerationBudget } from "@/lib/generation/generation-budget";
it.each(["poll-drinks", "quiz-general", "wheel-participants", "wheel-options"])("accepts a runtime-supported %s spec", (template) => {
  expect(validateRunnableSpec(templateSpec(template, "vi")).spec).not.toBeNull();
});
it("rejects unsupported input/view combinations, external links and reserved ids", () => {
  const spec = composeSpec();
  const block = spec.blocks[0]; if (block.type !== "compose") throw Error();
  block.inputs[0].multi = true;
  expect(validateRunnableSpec(spec).spec).toBeNull();
  block.inputs[0].multi = false;
  block.title = "Click https://external.example";
  expect(validateRunnableSpec(spec).spec).toBeNull();
  block.title = "Valid poll";
  block.id = "__proto__";
  expect(validateRunnableSpec(spec).spec).toBeNull();
});
describe("generation request budget", () => {
  it("enforces concurrent slots with idempotent release", () => {
    const budget = new GenerationBudget();
    const release = budget.acquire(10, 1);
    expect(() => budget.acquire(10, 1)).toThrow("rate_limited");
    release(); release();
    const next = budget.acquire(10, 1);
    expect(() => budget.acquire(10, 1)).toThrow("rate_limited"); next();
  });
  it("does not refund hourly attempts and resets the window independently of active calls", () => {
    let now = 1;
    const budget = new GenerationBudget(() => now);
    const release = budget.acquire(1, 1); release();
    expect(() => budget.acquire(1, 1)).toThrow("rate_limited");
    now += 3_600_000;
    expect(() => budget.acquire(1, 1)).not.toThrow();
  });
});
