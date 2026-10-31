// Chat view: wiring (text source, entries "many", roster) and results (oldest first, newest 200,
// removed messages hidden, viewer's own flagged).
import { describe, expect, it } from "vitest";
import { AppSpecSchema, type ComposeBlock } from "@/engine/app-spec/app-spec-schema";
import { exampleChatRoom } from "@/engine/app-spec/app-spec-examples-compose-chat";
import type { AnswerRow, AppRuntime } from "@/engine/blocks/block-definition-types";
import type { ComposePayload } from "@/engine/blocks/compose/compose-block";
import { computeComposeResults } from "@/engine/blocks/compose/compose-results";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ComposeChatView } from "@/engine-ui/blocks/compose-chat-view";

const runtime: AppRuntime = { openQuestionId: null, revealedQuestionIds: [] };
const chat = AppSpecSchema.parse(structuredClone(exampleChatRoom)).blocks[0] as ComposeBlock;
const hash = (c: string) => c.repeat(64);
const row = (who: string, n: number, payload: Omit<ComposePayload, "kind">, createdAt: number): AnswerRow<ComposePayload> => ({
  blockId: chat.id,
  itemId: `e-${who}${n}aaaaaa`,
  participantHash: hash(who),
  displayName: who.toUpperCase(),
  payload: { kind: "compose", ...payload },
  createdAt,
});
const say = (who: string, n: number, text: string, at: number) => row(who, n, { values: { message: text } }, at);
const feed = (answers: AnswerRow<ComposePayload>[], viewer = { isHost: false, participantHash: hash("a") as string | null }) => {
  const view = computeComposeResults(chat, answers, { appStatus: "active", runtime, viewer }).views[0];
  if (view.kind !== "chat") throw new Error("expected a chat view");
  return view.messages;
};

describe("chat wiring", () => {
  const withBlock = (patch: (b: Record<string, unknown>) => void) => {
    const draft = structuredClone(exampleChatRoom) as { blocks: Array<Record<string, unknown>> };
    patch(draft.blocks[0]);
    return AppSpecSchema.safeParse(draft).success;
  };

  it("accepts the example, which asks for names", () => {
    expect(AppSpecSchema.safeParse(structuredClone(exampleChatRoom)).success).toBe(true);
  });
  it("rejects a chat over a number input", () => {
    const numberInput = { id: "message", kind: "number", label: "Số", required: true, options: null, multi: null, capacity: null, min: null, max: null, unit: null };
    expect(withBlock((b) => (b.inputs = [numberInput]))).toBe(false);
  });
  it("rejects a chat in a one-record block", () => {
    expect(withBlock((b) => (b.entries = "one"))).toBe(false);
  });
  it("makes the app ask for names even when the draft says no", () => {
    const draft = { ...structuredClone(exampleChatRoom), requireName: false };
    const parsed = AppSpecSchema.parse(draft);
    expect(parsed.requireName).toBe(true);
  });
});

describe("chat results", () => {
  it("lists messages oldest first with author, time and the viewer's own flag", () => {
    const messages = feed([say("b", 1, "second", 20), say("a", 1, "first", 10), say("a", 2, "third", 30)]);
    expect(messages.map((m) => [m.text, m.author, m.at, m.mine])).toEqual([
      ["first", "A", 10, true],
      ["second", "B", 20, false],
      ["third", "A", 30, true],
    ]);
  });

  it("hides removed messages", () => {
    // the store keeps one record per (item, person): the removal replaces the message
    const messages = feed([say("a", 1, "oops", 10), say("b", 1, "hello", 20), row("a", 1, { values: {}, removed: true }, 30)].slice(1));
    expect(messages.map((m) => m.text)).toEqual(["hello"]);
  });

  it("keeps only the newest 200", () => {
    // six people, 40 messages each (a person keeps at most 50)
    const answers = Array.from({ length: 240 }, (_, i) => say("abcdef"[i % 6], 0, `m${i}`, i + 1)).map((a, i) => ({ ...a, itemId: `e-x${String(i).padStart(5, "0")}` }));
    const messages = feed(answers, { isHost: true, participantHash: null });
    expect(messages).toHaveLength(200);
    expect(messages[0].text).toBe("m40");
    expect(messages.at(-1)?.text).toBe("m239");
  });

  it("respects visibleTo", () => {
    const hidden = { ...chat, views: [{ ...chat.views[0], visibleTo: "host" as const }] };
    const answers = [say("a", 1, "hi", 10)];
    const results = computeComposeResults(hidden, answers, { appStatus: "active", runtime, viewer: { isHost: false, participantHash: hash("a") } });
    expect(results.views).toHaveLength(0);
  });
});

describe("chat message delete", () => {
  const view = (onRemove?: (id: string) => void) => {
    const messages = feed([say("a", 1, "mine", 10), say("b", 1, "theirs", 20)]);
    return { kind: "chat" as const, id: "feed", title: "t", messages, onRemove };
  };
  const html = (onRemove?: (id: string) => void) => {
    const { onRemove: remove, ...chatView } = view(onRemove);
    return renderToStaticMarkup(createElement(ComposeChatView, { view: chatView, locale: "vi", big: false, onRemove: remove }));
  };

  it("offers a delete button on the viewer's own messages only", () => {
    const withDelete = html(() => {});
    expect(withDelete.match(/Xoá/g)).toHaveLength(1);
    expect(withDelete.indexOf("Xoá")).toBeLessThan(withDelete.indexOf("theirs"));
  });
  it("shows no delete button when deleting is not possible (host screen, closed app)", () => {
    expect(html()).not.toContain("Xoá");
  });
  it("the record to delete is the message id without the author's roster id", () => {
    // a message id is "<12-hex roster id>-<record id>"; the delete names the record id, which the store keys by
    const [mine] = view().messages;
    expect(mine.id).toBe(`${"a".repeat(12)}-e-a1aaaaaa`);
  });
});
