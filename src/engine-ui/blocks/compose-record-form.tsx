"use client";
// The form for ONE compose record: the block's inputs (or just the open step), conditional inputs
// hidden until their condition holds, a live price preview for orders, and submit. A form whose only
// input is tap-to-pick (poll, slot, rating) sends on tap instead of showing a button.
import { useEffect, useRef, useState } from "react";
import type { ComposeResults, ResponsePayload } from "@/engine/api/api-contract-types";
import type { ComposeInput } from "@/engine/app-spec/app-spec-schema";
import type { PublicBlock } from "@/engine/app-spec/strip-private-fields";
import { inputShown } from "@/engine/blocks/compose/compose-answer-validation";
import { hasPrices } from "@/engine/blocks/compose/compose-aggregation-helpers";
import { orderLineTotal } from "@/engine/blocks/compose/compose-view-queries";
import { wordCount } from "@/engine/blocks/compose/text-answer-filters";
import { t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";
import { formatVnd } from "./bar-chart-live";
import { ComposeInputField, type DraftValue } from "./compose-input-field";
import { parseNumberInput } from "./compose-number-input";

type Compose = Extract<PublicBlock, { type: "compose" }>;
export type ComposeValues = Extract<ResponsePayload, { kind: "compose" }>["values"];

function draftFrom(saved: ResponsePayload | undefined): Record<string, DraftValue> {
  if (saved?.kind !== "compose") return {};
  return Object.fromEntries(Object.entries(saved.values).map(([k, v]) => [k, typeof v === "number" ? String(v) : v]));
}

/** Draft (strings) → payload values; empty and hidden fields are left out. */
function toValues(inputs: ComposeInput[], draft: Record<string, DraftValue>): ComposeValues {
  const values: ComposeValues = {};
  for (const input of inputs) {
    const v = draft[input.id];
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    if (input.kind === "number") {
      const n = typeof v === "string" ? parseNumberInput(v, input.unit) : null;
      if (n !== null) values[input.id] = n;
    } else if (input.kind === "rating") values[input.id] = Number(v);
    else if (input.kind === "buzz") values[input.id] = 1;
    else if (input.kind === "photo") values[input.id] = Array.isArray(v) ? v[0] : v;
    else if (((input.kind === "choice" || input.kind === "person") && input.multi) || input.kind === "rank") values[input.id] = Array.isArray(v) ? v : [v];
    else values[input.id] = Array.isArray(v) ? v[0] : v.trim();
  }
  for (const input of inputs) if (!inputShown(input, values)) delete values[input.id];
  return values;
}

export function ComposeRecordForm(props: {
  block: Compose;
  /** inputs of this form (all of them, or only the open step) */
  inputs: ComposeInput[];
  saved: ResponsePayload | undefined;
  results: ComposeResults | null;
  open: boolean;
  locale: UiLocale;
  onSend: (values: ComposeValues) => Promise<boolean>;
  /** list mode: clear the form after a successful send */
  resetAfterSend?: boolean;
  onCancel?: () => void;
  submitLabel?: string;
  /** chat composer: keep the cursor in the field after a send so the next message can follow at once */
  keepFocus?: boolean;
}) {
  const { block, inputs, saved, results, open, locale, onSend, resetAfterSend, onCancel, submitLabel, keepFocus } = props;
  const s = t(locale);
  const savedKey = saved ? JSON.stringify(saved) : "";
  const [draft, setDraftState] = useState<Record<string, DraftValue>>(() => draftFrom(saved));
  // Latest draft, updated synchronously: several quick edits in one render must not overwrite each other.
  const draftRef = useRef(draft);
  const setDraft = (next: Record<string, DraftValue>) => {
    draftRef.current = next;
    setDraftState(next);
  };
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const refocus = useRef(false);
  // Fields are disabled while a send is in flight; hand the cursor back once they are enabled again.
  useEffect(() => {
    if (busy || !refocus.current) return;
    refocus.current = false;
    formRef.current?.querySelector<HTMLInputElement>("input:not([disabled])")?.focus();
  }, [busy]);
  useEffect(() => {
    if (savedKey) setDraft(draftFrom(saved));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only resync when the saved record changes
  }, [savedKey]);

  const [only] = inputs;
  const tapToSubmit = !resetAfterSend && inputs.length === 1 && (only.kind === "slot" || only.kind === "rating" || only.kind === "buzz" || ((only.kind === "choice" || only.kind === "person") && !only.multi));
  const values = toValues(inputs, draft);
  const visible = inputs.filter((i) => inputShown(i, values));
  const tooManyWords = visible.some((i) => i.kind === "text" && i.max !== null && typeof values[i.id] === "string" && wordCount(values[i.id] as string) > i.max);
  const badNumber = visible.some((i) => i.kind === "number" && typeof draft[i.id] === "string" && (draft[i.id] as string).trim() !== "" && values[i.id] === undefined);
  const missing = tooManyWords || badNumber || visible.some((i) => i.required && values[i.id] === undefined);
  const ordersView = block.views.find((v) => v.kind === "orders");
  const priceLine = ordersView && hasPrices(block.inputs) ? orderLineTotal(block.inputs, values, ordersView.source).total : null;

  async function send(next: Record<string, DraftValue>) {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const ok = await onSend(toValues(inputs, next));
    // A failed tap-to-pick reverts to the saved pick; a failed form keeps what the person typed.
    if (!ok) {
      if (tapToSubmit) setDraft(draftFrom(saved));
      setFailed(true);
    } else if (resetAfterSend) {
      setDraft({});
      refocus.current = !!keepFocus;
    }
    setBusy(false);
  }

  return (
    <form
      className="compose-form"
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        if (!missing) void send(draftRef.current);
      }}
    >
      {visible.map((input) => (
        <ComposeInputField
          key={input.id}
          input={input}
          value={draft[input.id]}
          onChange={(v) => {
            const next = { ...draftRef.current, [input.id]: v };
            setDraft(next);
            if (tapToSubmit) void send(next);
          }}
          disabled={!open || busy}
          seats={results?.seats[input.id]}
          roster={results?.roster ?? []}
          locale={locale}
          hideLabel={input === inputs[0] && input.label === block.title}
          idPrefix={block.id}
        />
      ))}
      {priceLine !== null && (
        <div className="price-line">
          <span>{s.total}</span>
          <span className="num" style={{ color: "var(--app)" }}>{formatVnd(priceLine)}</span>
        </div>
      )}
      {open && !tapToSubmit && (
        <div className="compose-form-actions">
          <button className="btn btn-app btn-lg" type="submit" disabled={busy || missing}>
            {submitLabel ?? (saved ? s.update : s.submit)}
          </button>
          {onCancel && (
            <button className="btn btn-ghost" type="button" onClick={onCancel}>
              {s.composeCancel}
            </button>
          )}
        </div>
      )}
      {failed && (
        <div className="notice danger" role="alert">
          {s.composeNotSaved}
        </div>
      )}
      {saved && !resetAfterSend && !failed && <div className="status-line">{tapToSubmit ? s.voted : s.composeSaved}</div>}
    </form>
  );
}
