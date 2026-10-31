// Preview-only sample answers ("add sample participants"). They bypass validation (simulate route),
// so they respect word limits, conditions, list/steps modes and the open step themselves.
import type { AppRuntime } from "../block-definition-types";
import { DEFAULT_RATING_MAX, JOIN_ITEM_ID, type ComposeInput, type ComposePayload, type ComposeValue } from "./compose-atoms-schema";
import { formatLatLng } from "@/engine/geo/web-mercator-tiles";
import { inputShown } from "./compose-answer-validation";
import { buzzItemId, composeState } from "./compose-runtime-state";
import { wordCount } from "./text-answer-filters";

interface Block {
  id: string;
  entries?: "one" | "many";
  flow?: "open" | "steps";
  inputs: ComposeInput[];
}

function sampleValue(input: ComposeInput, random: () => number): ComposeValue | undefined {
  // Skewed toward the first options so a sample chart has a visible leader.
  const pick = <T,>(xs: readonly T[]) => xs[Math.min(xs.length - 1, Math.floor(random() ** 1.6 * xs.length))];
  switch (input.kind) {
    case "text":
      return pick(["Vui", "Hữu ích", "Tuyệt", "Thú vị", "Bổ ích", "Cần thêm thời gian"].filter((w) => input.max === null || wordCount(w) <= input.max));
    case "rating":
      return 1 + Math.floor(random() * (input.max ?? DEFAULT_RATING_MAX));
    case "number": {
      const money = input.unit === "đ";
      const lo = input.min ?? 0;
      const hi = Math.min(input.max ?? Infinity, lo + (money ? 2_000_000 : 5));
      const n = lo + random() * (hi - lo);
      return money ? Math.round(n / 1000) * 1000 : Math.round(n);
    }
    case "date":
    case "datetime": {
      const day = new Date(Date.UTC(2026, 9, 1 + Math.floor(random() * 5)));
      const date = day.toISOString().slice(0, 10);
      return input.kind === "date" ? date : `${date}T${pick(["09:00", "14:00", "19:30"])}`;
    }
    case "person":
      return undefined; // needs real roster ids: sample people only check in
    case "buzz":
      return 1;
    case "photo":
      return undefined; // a real upload is needed: sample people don't post photos
    case "place":
      // Somewhere in Việt Nam, at the 3-decimal precision real answers have.
      return formatLatLng({ lat: 9 + random() * 12, lng: 103 + random() * 6 });
    case "rank": {
      // A random full (or top-N) ordering.
      const ids = (input.options ?? []).map((o) => o.id);
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      return ids.length ? ids.slice(0, input.max ?? ids.length) : undefined;
    }
    default:
      if (!input.options?.length) return undefined;
      return input.kind === "choice" && input.multi ? [pick(input.options).id] : pick(input.options).id;
  }
}

export function composeSampleAnswer(block: Block, runtime: AppRuntime, random: () => number): { itemId: string; payload: ComposePayload } | null {
  if (block.flow === "steps") {
    const current = block.inputs.find((i) => i.id === composeState(runtime, block.id).step.current);
    const v = current ? sampleValue(current, random) : undefined;
    const itemId = current?.kind === "buzz" ? buzzItemId(current.id, composeState(runtime, block.id).epoch ?? 0) : current?.id;
    return current && itemId && v !== undefined ? { itemId, payload: { kind: "compose", values: { [current.id]: v } } } : null;
  }
  const values: ComposePayload["values"] = {};
  for (const input of block.inputs) {
    if (!inputShown(input, values)) continue;
    const v = sampleValue(input, random);
    if (v !== undefined) values[input.id] = v;
  }
  // A required photo needs a real upload: sample people can't answer such a block.
  if (block.inputs.some((i) => i.kind === "photo" && i.required && inputShown(i, values))) return null;
  if (block.inputs.some((i) => i.kind === "person" && i.required) || Object.keys(values).length === 0) {
    return { itemId: JOIN_ITEM_ID, payload: { kind: "compose", values: {}, join: true } };
  }
  const itemId = block.entries === "many" ? `e-${Math.floor(random() * 36 ** 8).toString(36).padStart(8, "0")}` : "";
  return { itemId, payload: { kind: "compose", values } };
}
