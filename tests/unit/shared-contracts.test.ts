import { describe, expect, it } from "vitest";
import { AppSpecSchema } from "@/lib/app-spec/app-spec-schema";
import { stripPrivateFields } from "@/lib/app-spec/strip-private-fields";
import { initialRuntime } from "@/lib/blocks/block-definition-types";
import { GenerateRequestSchema, SubmitResponseRequestSchema, parseBody } from "@/lib/api/request-schemas";
import { errorResponse } from "@/lib/api/route-helpers";
import { AppError } from "@/lib/api/app-error-codes";
import { newToken, hashToken, verifyToken, participantHashFor } from "@/lib/security/token-hashing";
import { quizSpec, composeSpec } from "../support/app-spec-fixtures";

describe("shared contracts", () => {
  it("rejects duplicate blocks and invalid quiz answer references", () => {
    const spec = quizSpec();
    expect(AppSpecSchema.safeParse({ ...spec, blocks: [...spec.blocks, ...spec.blocks] }).success).toBe(false);
    const block = spec.blocks[0];
    if (block.type !== "quiz") throw Error();
    block.questions[0].correct = "unknown";
    expect(AppSpecSchema.safeParse(spec).success).toBe(false);
  });
  it("validates compose wiring rather than only the JSON shape", () => {
    const spec = composeSpec();
    const block = spec.blocks[0];
    if (block.type !== "compose") throw Error();
    block.views[0].source = "missing";
    expect(AppSpecSchema.safeParse(spec).success).toBe(false);
    block.views[0].source = "drink";
    block.views[0].kind = "cloud";
    expect(AppSpecSchema.safeParse(spec).success).toBe(false);
  });
  it("hides correct answers before reveal without mutating stored spec", () => {
    const spec = quizSpec();
    const runtime = initialRuntime();
    const question = (value: ReturnType<typeof stripPrivateFields>) => {
      const block = value.blocks[0];
      if (block.type !== "quiz") throw Error();
      return block.questions[0];
    };
    expect(question(stripPrivateFields(spec, runtime)).correct).toBeNull();
    runtime.revealedQuestionIds.push("q1");
    expect(question(stripPrivateFields(spec, runtime)).correct).toBe("a");
    expect(question(spec).correct).toBe("a");
  });
  it("requires names for a participant wheel", () => {
    const spec = { ...quizSpec(), blocks: [{ type: "wheel", id: "draw", title: "Bốc thăm", source: "participants", options: [], removeWinner: true }] };
    expect(AppSpecSchema.safeParse(spec).success).toBe(false);
    expect(AppSpecSchema.safeParse({ ...spec, requireName: true }).success).toBe(true);
  });
  it("trims prompt, supplies lifetime and rejects unknown request keys", () => {
    expect(GenerateRequestSchema.parse({ prompt: "  vote  " })).toEqual({ prompt: "vote", lifetime: "1h" });
    expect(GenerateRequestSchema.safeParse({ prompt: "vote", apiKey: "secret" }).success).toBe(false);
    expect(SubmitResponseRequestSchema.safeParse({ blockId: "quiz", itemId: "q1", participantToken: "short", displayName: null, payload: { kind: "quiz", optionId: "a" } }).success).toBe(false);
  });
  it("handles malformed JSON and invalid schema without throwing", async () => {
    expect(await parseBody(new Request("http://local", { method: "POST", body: "{" }), GenerateRequestSchema)).toBeNull();
    expect(await parseBody(new Request("http://local", { method: "POST", body: '{"prompt":""}' }), GenerateRequestSchema)).toBeNull();
  });
  it("does not leak internal errors in API responses", async () => {
    const response = errorResponse(new Error("secret-provider-message"));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret-provider-message");
    expect(errorResponse(new AppError("ai_not_configured")).status).toBe(503);
  });
  it("verifies hashes and scopes participants to an app", () => {
    const token = newToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(verifyToken(token, hashToken(token))).toBe(true);
    expect(verifyToken("other", hashToken(token))).toBe(false);
    expect(verifyToken(token, "bad-hash")).toBe(false);
    expect(participantHashFor("app-1", token)).not.toBe(participantHashFor("app-2", token));
  });
});
