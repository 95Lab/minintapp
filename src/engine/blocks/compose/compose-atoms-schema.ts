// Atoms of the `compose` brick: small inputs (what a participant fills in) and small views (what the
// room sees), wired together by id. A view never runs code: it names a source input and one
// aggregation from a fixed list; compose-wiring-rules.ts rejects wiring that makes no sense
// (e.g. a word cloud over a number). This is how the AI assembles apps that no preset brick covers.
import { z } from "zod";
import { Id, OptionSchema, Text } from "../block-schema-primitives";
import { QuerySchema } from "./compose-query-engine";

export const INPUT_KINDS = ["text", "number", "choice", "rating", "slot", "person", "date", "datetime", "rank", "buzz", "photo", "place"] as const;
export const VIEW_KINDS = ["bars", "stat", "table", "leaderboard", "cloud", "groups", "split", "orders", "teams", "summary", "board", "chat", "map", "ranking", "fastest", "settle"] as const;
export const STAT_OPS = ["count", "sum", "avg", "min", "max"] as const;
export const VISIBILITY = ["everyone", "after_submit", "after_step", "after_close", "host"] as const;
/** one: one editable record per person; many: a list of records per person (expenses, ideas…). */
export const ENTRY_MODES = ["one", "many"] as const;
/** open: every input at once; steps: the host opens one input at a time (optionally timed). */
export const FLOW_MODES = ["open", "steps"] as const;

export type InputKind = (typeof INPUT_KINDS)[number];
export type ViewKind = (typeof VIEW_KINDS)[number];
export type StatOp = (typeof STAT_OPS)[number];

export const DEFAULT_RATING_MAX = 5;
export const TEXT_MAX_LENGTH = 200;
export const TEXT_MAX_WORDS_LIMIT = 50;
export const MAX_ENTRIES_PER_PERSON = 50;
/** Likes one person may give on a board (each like is one stored record). */
export const MAX_LIKES_PER_PERSON = 100;
const NUMBER_ABS_LIMIT = 1e12;

/** itemId of one record in `entries: "many"` mode (client-generated). */
export const ENTRY_ITEM_ID = /^e-[a-z0-9]{6,16}$/;
/** itemId of the roster check-in a participant sends when they open a block that needs a roster. */
export const JOIN_ITEM_ID = "_join";
/**
 * itemId of a like on a board entry: "l-" + the entry's public id. An entry's public id is its author's
 * roster id (public anyway) + its own itemId ("0" for a one-record block) — never the private hash.
 */
export const LIKE_ITEM_ID = /^l-[a-f0-9]{12}-(?:0|e-[a-z0-9]{6,16})$/;
/**
 * itemId of a participant's "I've transferred my share" mark on a settle view (one per person; the
 * mark is withdrawn with `removed: true`). The host's "received" mark lives in the block's runtime state.
 */
export const PAID_ITEM_ID = "_paid";
/**
 * Id of an uploaded photo: "p-" + its author's roster id + a random part. The roster id lets results
 * check that a photo answer really is the answering person's own upload.
 */
export const PHOTO_ID = /^p-[a-f0-9]{12}-[a-z0-9]{10}$/;
/** Uploads one person may make: room for re-picks and deleted entries (an upload isn't freed when unused). */
export const MAX_PHOTO_UPLOADS_PER_PERSON = 25;
export const MAX_PHOTOS_PER_APP = 300;
/** Upload size cap; phones resize to ≤ 1024 px JPEG (~100–250 KB) before sending. */
export const MAX_PHOTO_BYTES = 600_000;
export const entryIdOf = (participantHash: string, itemId: string) => `${participantHash.slice(0, 12)}-${itemId || "0"}`;
/** Public id of a participant in the roster: first 12 hex chars of their app-scoped hash. */
export const ROSTER_ID = /^[a-f0-9]{12}$/;
export const rosterIdOf = (participantHash: string) => participantHash.slice(0, 12);

export const DATE_VALUE = /^\d{4}-\d{2}-\d{2}$/;
export const DATETIME_VALUE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** An option of a choice/slot input; `price` (VND) makes it count toward an `orders` view's total. */
export const ComposeOptionSchema = OptionSchema.extend({ price: z.number().nonnegative().max(1e9).nullable() });
export type ComposeOption = z.infer<typeof ComposeOptionSchema>;

/** Show an input only when an earlier choice/slot input has `equals` selected. */
export const ShowIfSchema = z.object({ input: Id, equals: Id });
export type ShowIf = z.infer<typeof ShowIfSchema>;

/** One input field. Fields that don't apply to its kind are null (e.g. `capacity` only for slot). */
export const ComposeInputSchema = z.object({
  id: Id,
  kind: z.enum(INPUT_KINDS),
  label: Text,
  required: z.boolean(),
  /** choice / slot / rank */
  options: z.array(ComposeOptionSchema).min(2).max(20).nullable(),
  /** choice / person: several picks allowed */
  multi: z.boolean().nullable(),
  /** slot: seats per option; later sign-ups go to a waitlist */
  capacity: z.number().int().min(1).max(500).nullable(),
  /** number: allowed range; rating: `max` = number of stars (3–10); text: `max` = max words; rank: `max` = how many to rank (top N; null = all) */
  min: z.number().finite().min(-NUMBER_ABS_LIMIT).nullable(),
  max: z.number().finite().max(NUMBER_ABS_LIMIT).nullable(),
  /** number: shown after the value, e.g. "đ", "km" */
  unit: z.string().min(1).max(12).nullable(),
  /** conditional input (default: always shown) */
  showIf: ShowIfSchema.nullable().default(null),
  /** steps flow: seconds participants get once the host opens this input */
  timeLimitSec: z.number().int().min(5).max(600).nullable().default(null),
});
export type ComposeInput = z.infer<typeof ComposeInputSchema>;

export const ComposeViewSchema = z.object({
  id: Id,
  kind: z.enum(VIEW_KINDS),
  /** null → the source input's label */
  title: Text.nullable(),
  /** id of the input this view reads (null for table, teams, or stat with op "count") */
  source: Id.nullable(),
  /** stat; leaderboard (per-person aggregation, default sum) */
  op: z.enum(STAT_OPS).nullable(),
  /** leaderboard only (default 10) */
  topN: z.number().int().min(1).max(50).nullable(),
  /** teams only: number of teams the host shuffles the roster into */
  teams: z.number().int().min(2).max(20).nullable().default(null),
  /** summary only: the calculation as data (compose-query-engine.ts), shown as a table */
  query: QuerySchema.nullable().default(null),
  visibleTo: z.enum(VISIBILITY),
});
export type ComposeView = z.infer<typeof ComposeViewSchema>;

/** One participant record: input id → value (string for text/choice/slot/person/date, number, or ids for multi picks). */
export const ComposeValueSchema = z.union([z.string().max(TEXT_MAX_LENGTH), z.number().finite(), z.array(Id).max(20)]);
export type ComposeValue = z.infer<typeof ComposeValueSchema>;

export const ComposePayloadSchema = z
  .object({
    kind: z.literal("compose"),
    values: z.record(Id, ComposeValueSchema).refine((v) => Object.keys(v).length <= 8),
    /** roster check-in (itemId "_join", no values) */
    join: z.literal(true).optional(),
    /** a like on a board entry (itemId "l-<entry id>", no values); unlike = `removed: true` */
    like: z.literal(true).optional(),
    /** a settle view's "I've transferred" mark (itemId "_paid", no values): the whole đồng amount the person owed when marking; withdrawn with `removed: true` */
    paid: z.number().int().min(1).max(NUMBER_ABS_LIMIT).optional(),
    /** deletes one record in `entries: "many"` mode (no values) */
    removed: z.literal(true).optional(),
  })
  .strict();
export type ComposePayload = z.infer<typeof ComposePayloadSchema>;
