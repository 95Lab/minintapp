// Brick: live — a read-only card of live data: weather (3-day forecast for a place) or an exchange
// rate with a converter. Nobody answers it. The server fetches from fixed hosts (live-data-fetchers.ts);
// the AI only picks the source and plain parameters, never a URL. Data arrives through `prefetch`.
import { z } from "zod";
import type { BlockDefinition } from "../block-definition-types";
import { Id, jsonNullableEnum, jsonNullableString, Text } from "../block-schema-primitives";
import { FX_CODES, type FxCode, type LiveData } from "@/engine/live-data/live-data-fetchers";
import { loadLiveData, type LiveRequest } from "@/engine/live-data/live-data-loader";

export const LIVE_PLACE_MAX_CHARS = 60;

const FxCodeSchema = z.enum(FX_CODES);
// A place is a name, never a link or markup (it also goes through the phishing scan).
const PlaceSchema = z
  .string()
  .trim()
  .min(1)
  .max(LIVE_PLACE_MAX_CHARS)
  .refine((p) => !/[/\\<>@]|https?:|www\./i.test(p), { message: "place must be a city or area name, not a URL" });

export const LiveBlockSchema = z
  .object({
    type: z.literal("live"),
    id: Id,
    title: Text,
    source: z.enum(["weather", "fx"]),
    place: PlaceSchema.nullable(),
    base: FxCodeSchema.nullable(),
    quote: FxCodeSchema.nullable(),
  })
  .superRefine((b, ctx) => {
    if (b.source === "weather" && b.place === null) ctx.addIssue({ code: "custom", path: ["place"], message: "weather needs a place" });
    if (b.source === "fx") {
      if (b.base === null) ctx.addIssue({ code: "custom", path: ["base"], message: "fx needs a base currency" });
      if (b.quote === null) ctx.addIssue({ code: "custom", path: ["quote"], message: "fx needs a quote currency" });
      if (b.base !== null && b.base === b.quote) ctx.addIssue({ code: "custom", path: ["quote"], message: "base and quote must differ" });
    }
  });
export type LiveBlock = z.infer<typeof LiveBlockSchema>;

/** Nobody answers a live card; the schema exists for the registry and accepts nothing real. */
export const LivePayloadSchema = z.object({ kind: z.literal("live") }).strict();
export type LivePayload = z.infer<typeof LivePayloadSchema>;

export interface LiveResults {
  type: "live";
  blockId: string;
  source: LiveBlock["source"];
  /** null: the upstream could not be reached (the card says so) */
  data: LiveData | null;
}

/** The fetch this block asks for, or null for a spec that is missing its parameters. */
function requestOf(b: LiveBlock): LiveRequest | null {
  if (b.source === "weather") return b.place ? { source: "weather", place: b.place } : null;
  return b.base && b.quote ? { source: "fx", base: b.base, quote: b.quote } : null;
}

const asFxCode = (v: unknown): FxCode | null => (typeof v === "string" && (FX_CODES as readonly string[]).includes(v.trim().toUpperCase()) ? (v.trim().toUpperCase() as FxCode) : null);

export const liveBlock: BlockDefinition<LiveBlock, LivePayload, LiveResults> = {
  type: "live",
  label: { vi: "Dữ liệu trực tiếp", en: "Live data" },
  promptDoc: `live — thẻ dữ liệu trực tiếp, KHÔNG ai trả lời: title, liveSource: "weather" (dự báo 3 ngày; place = tên thành phố/khu vực, tối đa 60 ký tự,
   KHÔNG BAO GIỜ là URL) hoặc "fx" (tỷ giá; base + quote là mã tiền: ${FX_CODES.join(", ")}; có công cụ đổi tiền). CHỈ hai nguồn này.`,
  promptRules: `- chuyến đi / sự kiện ngoài trời / picnic / dã ngoại cần biết thời tiết → thêm live (liveSource "weather", place = nơi đến), ghép với compose/vote.
- ngân sách chuyến đi nước ngoài / chia tiền ngoại tệ cần tỷ giá → thêm live (liveSource "fx", base = tiền nước đến, quote = "VND" hoặc tiền của nhóm).
- Không có nguồn nào khác (không tin tức, giá vàng, chứng khoán…): đừng bịa liveSource.`,

  specSchema: LiveBlockSchema,
  payloadSchema: LivePayloadSchema,

  llmFields: {
    title: { json: jsonNullableString, wire: z.string().nullable() },
    liveSource: { json: jsonNullableEnum(["weather", "fx"]), wire: z.enum(["weather", "fx"]).nullable() },
    place: { json: jsonNullableString, wire: z.string().nullable() },
    base: { json: jsonNullableString, wire: z.string().nullable() },
    quote: { json: jsonNullableString, wire: z.string().nullable() },
  },
  fromFlat: (f) => {
    const base = asFxCode(f.base);
    const quote = asFxCode(f.quote);
    // No explicit source: currencies mean fx, anything else is a weather card. Params of the other source are dropped.
    const source = f.liveSource === "fx" || f.liveSource === "weather" ? f.liveSource : base || quote ? "fx" : "weather";
    const place = typeof f.place === "string" && f.place.trim() ? f.place.trim() : null;
    return {
      type: "live",
      id: f.id,
      title: (f.title as string) ?? "",
      source,
      place: source === "weather" ? place : null,
      base: source === "fx" ? base : null,
      quote: source === "fx" ? quote : null,
    };
  },
  toFlat: (b) => ({ title: b.title, liveSource: b.source, place: b.place, base: b.base, quote: b.quote }),

  // There is nothing to answer.
  validate: () => "bad_payload",

  async prefetch(block) {
    const request = requestOf(block);
    return request ? loadLiveData(request) : null;
  },

  computeResults(block, _rows, ctx) {
    const data = (ctx.prefetched as LiveData | null | undefined) ?? null;
    return { type: "live", blockId: block.id, source: block.source, data };
  },

  summarizeForRemix: (block) => (block.source === "weather" ? `${block.title}: ${block.place}` : `${block.title}: ${block.base}/${block.quote}`),

  security: {
    inputLabels: () => [],
    instructionTexts: (b) => [b.title],
    allTexts: (b) => [b.title, b.place ?? ""],
  },
};
