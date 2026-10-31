// validateResponsePayload: common checks (block exists, payload kind, display name) plus the
// brick's own rules. Polls and order forms are compose blocks at runtime (expanded presets).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateResponsePayload } from "@/engine/responses/validate-response-payload";
import { appsRepository, resetMemoryStore, type AppRecord } from "@/engine/db/apps-repository";
import type { ResponsePayload, SubmitResponseRequest } from "@/engine/api/api-contract-types";
import type { ComposeBlock } from "@/engine/app-spec/app-spec-schema";
import { exampleWorkshopVote, examplePasswordQuiz, exampleMilkTeaOrder } from "@/engine/app-spec/app-spec-examples";
import { runtimeSpec } from "./runtime-spec-test-helper";

const HOUR = 3_600_000;
const compose = (values: Extract<ResponsePayload, { kind: "compose" }>["values"]): ResponsePayload => ({ kind: "compose", values });
const request = (blockId: string, payload: ResponsePayload, extra: Partial<SubmitResponseRequest> = {}): SubmitResponseRequest => ({
  blockId,
  itemId: "",
  participantToken: "test-token",
  displayName: "Alice",
  payload,
  ...extra,
});

describe("validateResponsePayload", () => {
  describe("poll (choice preset)", () => {
    let app: AppRecord;
    beforeEach(async () => {
      resetMemoryStore();
      app = (await appsRepository().createApp({ spec: runtimeSpec(exampleWorkshopVote), prompt: "test", lifetimeMs: HOUR })).app;
    });
    afterEach(() => resetMemoryStore());
    const blockId = () => app.spec.blocks[0].id;

    it("accepts a valid vote", () => {
      expect(validateResponsePayload(app, request(blockId(), compose({ vote: "ai-agent" })))).toBeNull();
    });
    it("rejects an unknown block", () => {
      expect(validateResponsePayload(app, request("unknown-block", compose({ vote: "ai-agent" })))).toBe("unknown_block");
    });
    it("rejects a non-empty itemId", () => {
      expect(validateResponsePayload(app, request(blockId(), compose({ vote: "ai-agent" }), { itemId: "x" }))).toBe("bad_payload");
    });
    it("rejects unknown options, several picks on a single-choice poll, and empty votes", () => {
      expect(validateResponsePayload(app, request(blockId(), compose({ vote: "nope" })))).toBe("bad_payload");
      expect(validateResponsePayload(app, request(blockId(), compose({ vote: ["ai-agent", "ux"] })))).toBe("bad_payload");
      expect(validateResponsePayload(app, request(blockId(), compose({})))).toBe("bad_payload");
    });
    it("rejects a payload of another brick kind", () => {
      expect(validateResponsePayload(app, request(blockId(), { kind: "quiz", optionId: "a" } as ResponsePayload))).toBe("bad_payload");
    });
  });

  describe("quiz block validation", () => {
    let app: AppRecord;
    let repo = appsRepository();

    beforeEach(async () => {
      resetMemoryStore();
      repo = appsRepository();
      const { app: created } = await repo.createApp({ spec: runtimeSpec(examplePasswordQuiz), prompt: "test", lifetimeMs: 3600000 });
      app = created;
      // Open first question
      if (app.spec.blocks[0]?.type === "quiz") {
        await repo.updateApp(app.id, { runtime: { openQuestionId: app.spec.blocks[0].questions[0]?.id ?? null, revealedQuestionIds: [] } });
        app = (await repo.findApp(app.id))!;
      }
    });

    afterEach(() => {
      resetMemoryStore();
    });

    it("accepts valid quiz response when question is open", () => {
      const quizBlock = app.spec.blocks[0];
      if (quizBlock?.type === "quiz") {
        const question = quizBlock.questions[0];
        const req: SubmitResponseRequest = {
          blockId: quizBlock.id,
          itemId: question.id,
          participantToken: "test-token-bob", displayName: "Bob",
          payload: { kind: "quiz", optionId: question.options[0].id },
        };

        const error = validateResponsePayload(app, req);
        expect(error).toBeNull();
      }
    });

    it("rejects quiz response with nonexistent question", () => {
      const quizBlock = app.spec.blocks[0];
      if (quizBlock?.type === "quiz") {
        const req: SubmitResponseRequest = {
          blockId: quizBlock.id,
          itemId: "nonexistent-question",
          participantToken: "test-token-bob", displayName: "Bob",
          payload: { kind: "quiz", optionId: quizBlock.questions[0].options[0].id },
        };

        const error = validateResponsePayload(app, req);
        expect(error).toBe("bad_payload");
      }
    });

    it("rejects quiz response when question not open", () => {
      const quizBlock = app.spec.blocks[0];
      if (quizBlock?.type === "quiz") {
        app.runtime.openQuestionId = null;
        const question = quizBlock.questions[0];
        const req: SubmitResponseRequest = {
          blockId: quizBlock.id,
          itemId: question.id,
          participantToken: "test-token-bob", displayName: "Bob",
          payload: { kind: "quiz", optionId: question.options[0].id },
        };

        const error = validateResponsePayload(app, req);
        expect(error).toBe("question_closed");
      }
    });

    it("rejects quiz response when question is revealed", () => {
      const quizBlock = app.spec.blocks[0];
      if (quizBlock?.type === "quiz") {
        const question = quizBlock.questions[0];
        app.runtime.revealedQuestionIds.push(question.id);
        const req: SubmitResponseRequest = {
          blockId: quizBlock.id,
          itemId: question.id,
          participantToken: "test-token-bob", displayName: "Bob",
          payload: { kind: "quiz", optionId: question.options[0].id },
        };

        const error = validateResponsePayload(app, req);
        expect(error).toBe("question_closed");
      }
    });

    it("rejects quiz response with invalid option", () => {
      const quizBlock = app.spec.blocks[0];
      if (quizBlock?.type === "quiz") {
        const question = quizBlock.questions[0];
        const req: SubmitResponseRequest = {
          blockId: quizBlock.id,
          itemId: question.id,
          participantToken: "test-token-bob", displayName: "Bob",
          payload: { kind: "quiz", optionId: "invalid-option-id" },
        };

        const error = validateResponsePayload(app, req);
        expect(error).toBe("bad_payload");
      }
    });
  });


  describe("order form (collect preset)", () => {
    let app: AppRecord;
    let block: ComposeBlock;
    beforeEach(async () => {
      resetMemoryStore();
      app = (await appsRepository().createApp({ spec: runtimeSpec(exampleMilkTeaOrder), prompt: "test", lifetimeMs: HOUR })).app;
      block = app.spec.blocks[0] as ComposeBlock;
    });
    afterEach(() => resetMemoryStore());
    /** A valid order: first option of every choice input. */
    const order = (): Record<string, string | number> =>
      Object.fromEntries(block.inputs.filter((i) => i.kind === "choice").map((i) => [i.id, i.options![0].id]));
    const qtyId = () => block.inputs.find((i) => i.kind === "number")!.id;

    it("accepts a valid order, with or without the optional quantity", () => {
      expect(validateResponsePayload(app, request(block.id, compose(order())))).toBeNull();
      expect(validateResponsePayload(app, request(block.id, compose({ ...order(), [qtyId()]: 2 })))).toBeNull();
    });
    it("rejects an unknown option, a quantity outside 1-99, and unknown fields", () => {
      const firstChoice = block.inputs.find((i) => i.kind === "choice")!.id;
      expect(validateResponsePayload(app, request(block.id, compose({ ...order(), [firstChoice]: "khong-co" })))).toBe("bad_payload");
      expect(validateResponsePayload(app, request(block.id, compose({ ...order(), [qtyId()]: 100 })))).toBe("bad_payload");
      expect(validateResponsePayload(app, request(block.id, compose({ ...order(), extra: "x" })))).toBe("bad_payload");
    });
    it("rejects a missing required choice", () => {
      expect(validateResponsePayload(app, request(block.id, compose({ [qtyId()]: 1 })))).toBe("bad_payload");
    });
    it("rejects a note longer than 200 characters", () => {
      const note = block.inputs.find((i) => i.kind === "text")!.id;
      expect(validateResponsePayload(app, request(block.id, compose({ ...order(), [note]: "A".repeat(201) })))).toBe("too_long");
    });
  });

  describe("name validation", () => {
    let app: AppRecord;
    beforeEach(async () => {
      resetMemoryStore();
      app = (await appsRepository().createApp({ spec: runtimeSpec({ ...exampleWorkshopVote, requireName: true }), prompt: "test", lifetimeMs: HOUR })).app;
    });
    afterEach(() => resetMemoryStore());
    const vote = () => request(app.spec.blocks[0].id, compose({ vote: "ai-agent" }));

    it("rejects a missing or whitespace-only name when required", () => {
      expect(validateResponsePayload(app, { ...vote(), displayName: "" })).toBe("name_required");
      expect(validateResponsePayload(app, { ...vote(), displayName: "   " })).toBe("name_required");
    });
    it("rejects a name longer than 40 characters", () => {
      expect(validateResponsePayload(app, { ...vote(), displayName: "A".repeat(41) })).toBe("too_long");
    });
  });
});
