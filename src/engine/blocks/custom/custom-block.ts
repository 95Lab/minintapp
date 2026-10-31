// Brick: custom — a small interactive page the AI writes (mini game, calculator, interactive
// explainer), run in a sandboxed iframe (see sandbox-document.ts and src/app/sandbox). The page talks
// to the room through window.minint: submit(value) stores ONE small JSON per person (latest wins) and
// state delivers everyone's latest submissions. Meant only for what compose atoms cannot express.
import { z } from "zod";
import type { BlockDefinition } from "../block-definition-types";
import { Id, jsonNullableString, Text } from "../block-schema-primitives";
import { resultLabels } from "@/engine/i18n/result-labels-vi-en";
import { CUSTOM_HTML_MAX_CHARS, scanCustomCode } from "@/engine/security/custom-code-scan";
import { scriptStrings, visibleText } from "./custom-html-text";
import { CUSTOM_VALUE_MAX_CHARS } from "./sandbox-document";

export const CustomBlockSchema = z.object({
  type: z.literal("custom"),
  id: Id,
  title: Text,
  html: z.string().min(1).max(CUSTOM_HTML_MAX_CHARS),
}).superRefine((b, ctx) => {
  // Code that could leave the sandbox or harvest credentials never validates: generation then retries or refuses.
  for (const issue of scanCustomCode(b.html)) ctx.addIssue({ code: "custom", path: ["html"], message: `custom code refused: ${issue}` });
});
export type CustomBlock = z.infer<typeof CustomBlockSchema>;

/** One small JSON value per person; the latest submission replaces the previous one. */
export const CustomPayloadSchema = z
  .object({
    kind: z.literal("custom"),
    value: z.json().refine((v) => JSON.stringify(v).length <= CUSTOM_VALUE_MAX_CHARS, { message: `value must be JSON up to ${CUSTOM_VALUE_MAX_CHARS} characters` }),
    /** server receive time of this submission (the responses route overwrites whatever a client sends) */
    at: z.number().int().nonnegative().optional(),
  })
  .strict();
export type CustomPayload = z.infer<typeof CustomPayloadSchema>;

export const MAX_CUSTOM_ANSWERS = 200;

export interface CustomAnswer {
  name: string;
  value: unknown;
  at: number;
}
export interface CustomResults {
  type: "custom";
  blockId: string;
  /** everyone's latest submission, newest last (at most MAX_CUSTOM_ANSWERS) */
  answers: CustomAnswer[];
  count: number;
}

export const customBlock: BlockDefinition<CustomBlock, CustomPayload, CustomResults> = {
  type: "custom",
  label: { vi: "Trang tương tác tự viết", en: "Custom interactive page" },
  promptDoc: `custom — trang HTML/JS tương tác do bạn viết (mini game, máy tính, giải thích tương tác): title, html (≤ 12000 ký tự,
   chỉ phần thân + <script>/<style> inline). CHỈ dùng khi KHÔNG brick nào khác và không ghép compose nào làm được.
   Chạy trong sandbox, không có mạng. API duy nhất: window.minint.submit(value) gửi 1 JSON nhỏ (≤ 2000 ký tự, mỗi người giữ lần
   gửi mới nhất); window.minint.onState(cb) nhận {role:"host"|"participant", me:{name}|null, answers:[{name,value,at}], count}
   (answers = lần gửi mới nhất của mọi người, dùng để làm bảng xếp hạng). CẤM: <form>, <iframe>, <object>, <embed>, <base>, <link>,
   <meta http-equiv>, mọi URL http(s), fetch/XMLHttpRequest/WebSocket/sendBeacon/importScripts/Worker, eval/Function, document.cookie,
   localStorage/sessionStorage/indexedDB, window.open, mọi location/history/document.domain/window.name, URL bắt đầu bằng //, và mọi chữ mật khẩu/OTP/PIN/CVV/số thẻ.`,
  promptRules: `- "mini game" / "trò chơi bấm nhanh" / "máy tính" / "mô phỏng" mà không brick nào làm được → custom (html tự chứa,
  gửi điểm bằng window.minint.submit, hiện bảng xếp hạng từ onState). Có brick/compose phù hợp thì KHÔNG dùng custom.`,

  specSchema: CustomBlockSchema,
  payloadSchema: CustomPayloadSchema,

  llmFields: {
    title: { json: jsonNullableString, wire: z.string().nullable() },
    html: { json: jsonNullableString, wire: z.string().nullable() },
  },
  fromFlat: (f) => ({ type: "custom", id: f.id, title: (f.title as string) ?? "", html: (f.html as string) ?? "" }),
  toFlat: (b) => ({ title: b.title, html: b.html }),

  validate: (_block, _payload, { itemId }) => (itemId === "" ? null : "bad_payload"),

  computeResults(block, rows, ctx) {
    const anonymous = resultLabels(ctx.locale ?? "vi").anonymous;
    const answers = [...rows]
      // a stored row keeps its first created_at, so "newest last" follows the time of the latest submission
      .map((r) => ({ name: r.displayName || anonymous, value: r.payload.value, at: r.payload.at ?? r.createdAt }))
      .sort((a, b) => a.at - b.at)
      .slice(-MAX_CUSTOM_ANSWERS);
    return { type: "custom", blockId: block.id, answers, count: new Set(rows.map((r) => r.participantHash)).size };
  },

  summarizeForRemix: (block, r) => `${block.title}: ${r?.count ?? 0} lượt gửi`,

  // The page's own words count as instructions: a "enter your OTP" screen is exactly what the scan is for.
  security: {
    inputLabels: () => [],
    instructionTexts: (b) => [b.title, visibleText(b.html), ...scriptStrings(b.html)],
    // Script string literals are text the page can put on screen at run time, so the link and
    // account-number rules read them too (a page must not show a bank account or a link any more than a spec may).
    allTexts: (b) => [b.title, visibleText(b.html), ...scriptStrings(b.html)],
  },

  sampleAnswer: (_block, _runtime, random) => ({ itemId: "", payload: { kind: "custom", value: { score: Math.floor(random() * 100) } } }),
};
