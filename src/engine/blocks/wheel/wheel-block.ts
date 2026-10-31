// Brick: wheel — lucky wheel / random draw. Candidates are either a fixed list (`options`) or the
// participants who joined the draw. The winner is picked on the SERVER (crypto random) and stored
// in runtime, so every phone animates to the same, fair result.
import { z } from "zod";
import { blockState, withBlockState, type BlockDefinition } from "../block-definition-types";
import { Id, jsonNullableBoolean, jsonNullableEnum, jsonNullableOptions, jsonNullableString, OptionSchema, Text, wireOption } from "../block-schema-primitives";

export const WheelBlockSchema = z
  .object({
    type: z.literal("wheel"),
    id: Id,
    title: Text,
    source: z.enum(["options", "participants"]),
    options: z.array(OptionSchema).max(30),
    removeWinner: z.boolean(),
  })
  .refine((b) => b.source === "participants" || b.options.length >= 2, { message: "wheel with source=options needs at least 2 options", path: ["options"] });
export type WheelBlock = z.infer<typeof WheelBlockSchema>;

/** Joining the draw (source=participants). The display name is the entry's label. */
export const WheelPayloadSchema = z.object({ kind: z.literal("wheel"), join: z.literal(true) }).strict();
export type WheelPayload = z.infer<typeof WheelPayloadSchema>;

export interface WheelSpin {
  /** unique per spin so clients know to animate */
  spinId: string;
  entryId: string;
  label: string;
  at: number;
}
export interface WheelState {
  spins: WheelSpin[];
  removedEntryIds?:string[];
}
export interface WheelResults {
  type: "wheel";
  blockId: string;
  /** current candidates (winners removed when removeWinner) */
  entries: Array<{ id: string; label: string }>;
  spins: WheelSpin[];
}

const ANONYMOUS = "Ẩn danh";
const MAX_SPINS_KEPT = 50;

function allEntries(block: WheelBlock, answers: Array<{ participantHash: string; displayName: string | null }>) {
  if (block.source === "options") return block.options.map((o) => ({ id: o.id, label: o.label }));
  return answers.map((a, i) => ({ id: a.participantHash.slice(0, 16), label: a.displayName || `${ANONYMOUS} #${i + 1}` }));
}

function candidates(block: WheelBlock, state: WheelState, answers: Array<{ participantHash: string; displayName: string | null }>) {
  const entries = allEntries(block, answers);
  if (!block.removeWinner) return entries;
  const won = new Set(state.removedEntryIds ?? state.spins.map((s) => s.entryId));
  return entries.filter((e) => !won.has(e.id));
}

export const wheelBlock: BlockDefinition<WheelBlock, WheelPayload, WheelResults> = {
  type: "wheel",
  label: { vi: "Vòng quay / bốc thăm", en: "Lucky wheel / draw" },
  promptDoc: `wheel — vòng quay may mắn / bốc thăm: title, source ("options" = quay trong danh sách cố định;
   "participants" = quay trong số người tham gia bấm "tham gia"), options (danh sách {id,label} khi source "options",
   2–30; [] khi "participants"), removeWinner (loại người/ô đã trúng khỏi các lần quay sau).`,
  promptRules: `- "vòng quay" / "quay số" / "bốc thăm" / "lucky wheel" / "random pick" → wheel. Có danh sách giải/tên cụ thể
  → source "options"; "bốc thăm người tham gia" / "chọn ngẫu nhiên người trả lời" / không có danh sách cụ thể
  (vd. "vòng quay may mắn cho sự kiện, ai trúng có quà") → source "participants", options [], requireName: true.
- "không trùng" / "mỗi người trúng 1 lần" / "no repeats" → removeWinner: true.`,

  specSchema: WheelBlockSchema,
  payloadSchema: WheelPayloadSchema,

  llmFields: {
    title: { json: jsonNullableString, wire: z.string().nullable() },
    source: { json: jsonNullableEnum(["options", "participants"]), wire: z.enum(["options", "participants"]).nullable() },
    options: { json: jsonNullableOptions, wire: z.array(wireOption).nullable() },
    removeWinner: { json: jsonNullableBoolean, wire: z.boolean().nullable() },
  },
  fromFlat: (f) => ({
    type: "wheel",
    id: f.id,
    title: (f.title as string) ?? "",
    // "options" with no options is a wheel with nothing on it: spin among the people in the room instead.
    source: f.source === "participants" || !(f.options as WheelBlock["options"] | null)?.length ? "participants" : "options",
    options: (f.options as WheelBlock["options"]) ?? [],
    removeWinner: (f.removeWinner as boolean) ?? false,
  }),
  toFlat: (b) => ({ title: b.title, source: b.source, options: b.options, removeWinner: b.removeWinner }),

  validate: (block, _p, { itemId }) => (itemId === "" && block.source === "participants" ? null : "bad_payload"),

  computeResults(block, rows, { runtime }) {
    const state = blockState<WheelState>(runtime, block.id, { spins: [] });
    return { type: "wheel", blockId: block.id, entries: candidates(block, state, rows), spins: state.spins };
  },

  summarizeForRemix(block, r) {
    const last = r?.spins.at(-1);
    return `${block.title}: ${r?.entries.length ?? 0} ô${last ? `, lần quay gần nhất trúng ${last.label}` : ""}`;
  },

  security: {
    inputLabels: () => [],
    instructionTexts: (b) => [b.title, ...b.options.map((o) => o.label)],
    allTexts: (b) => [b.title, ...b.options.map((o) => o.label)],
  },

  hostActions: {
    spin(block, runtime, { random, answers, now }) {
      const state = blockState<WheelState>(runtime, block.id, { spins: [] });
      const pool = candidates(block, state, answers);
      if (pool.length === 0) return { ok: false, error: block.source === "participants" ? "wheel_no_entrants" : "wheel_empty" };
      const winner = pool[Math.floor(random() * pool.length)];
      const spin: WheelSpin = { spinId: `${(now ?? Date.now()).toString(36)}${Math.floor(random() * 1e6).toString(36)}`, entryId: winner.id, label: winner.label, at: now ?? Date.now() };
      return { ok: true, runtime: withBlockState(runtime, block.id, { spins: [...state.spins, spin].slice(-MAX_SPINS_KEPT), removedEntryIds:block.removeWinner?[...state.removedEntryIds??[],winner.id]:[] }) };
    },
    reset(block, runtime) {
      return { ok: true, runtime: withBlockState(runtime, block.id, { spins: [] }) };
    },
  },

  sampleAnswer: (block) => (block.source === "participants" ? { itemId: "", payload: { kind: "wheel", join: true } } : null),
};
