"use client";
// entries "many": the participant's own list (expenses, ideas…) with edit / remove, plus a form that
// adds a new line. Each line is its own record (itemId "e-…"); removing sends `removed: true`.
import { useState } from "react";
import { resultLabels } from "@/engine/i18n/result-labels-vi-en";
import type { ComposeResults, ResponsePayload } from "@/engine/api/api-contract-types";
import type { PublicBlock } from "@/engine/app-spec/strip-private-fields";
import { formatComposeValue } from "@/engine/blocks/compose/compose-aggregation-helpers";
import { MAX_ENTRIES_PER_PERSON } from "@/engine/blocks/compose/compose-atoms-schema";
import { t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";
import { ComposeRecordForm, type ComposeValues } from "./compose-record-form";

type Compose = Extract<PublicBlock, { type: "compose" }>;

/** Unguessable, regex-safe id for a new line (itemId). */
function newEntryId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `e-${Array.from(bytes, (b) => (b % 36).toString(36)).join("")}`;
}

export function ComposeEntriesList(props: {
  block: Compose;
  results: ComposeResults | null;
  myAnswers: Record<string, ResponsePayload>;
  open: boolean;
  locale: UiLocale;
  onSubmit: (itemId: string, payload: ResponsePayload) => Promise<boolean>;
}) {
  const { block, results, myAnswers, open, locale, onSubmit } = props;
  const s = t(locale);
  const [editing, setEditing] = useState<string | null>(null);
  const prefix = `${block.id}:`;
  const mine = Object.entries(myAnswers).filter(
    ([key, p]) => key.startsWith(`${prefix}e-`) && p.kind === "compose" && !p.removed && Object.keys(p.values).length > 0,
  ) as Array<[string, Extract<ResponsePayload, { kind: "compose" }>]>;
  // A chat shows messages in its feed; the form is just a composer (no "my entries" list to edit).
  const chat = block.views.some((v) => v.kind === "chat");
  const send = (itemId: string, values: ComposeValues) => onSubmit(itemId, { kind: "compose", values });

  return (
    <div className="compose-entries">
      {mine.length > 0 && !chat && (
        <div className="compose-entry-list">
          <div className="panel-title">{s.composeMyEntries}</div>
          {mine.map(([key, payload]) => {
            const itemId = key.slice(prefix.length);
            if (editing === itemId) {
              return (
                <ComposeRecordForm
                  key={key}
                  block={block}
                  inputs={block.inputs}
                  saved={payload}
                  results={results}
                  open={open}
                  locale={locale}
                  onSend={async (values) => {
                    const ok = await send(itemId, values);
                    if (ok) setEditing(null);
                    return ok;
                  }}
                  onCancel={() => setEditing(null)}
                />
              );
            }
            const summary = block.inputs
              .map((i) => formatComposeValue(i, payload.values[i.id], results?.roster ?? [], false, resultLabels(locale)))
              .filter(Boolean)
              .join(" · ");
            return (
              <div key={key} className="compose-entry">
                <span>{summary}</span>
                {open && (
                  <span className="compose-entry-actions">
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(itemId)}>
                      {s.composeEdit}
                    </button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => void onSubmit(itemId, { kind: "compose", values: {}, removed: true })}>
                      {s.composeRemove}
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {open && editing === null && mine.length >= MAX_ENTRIES_PER_PERSON && <div className="muted">{s.composeEntriesFull(MAX_ENTRIES_PER_PERSON)}</div>}
      {open && editing === null && mine.length < MAX_ENTRIES_PER_PERSON && (
        <ComposeRecordForm
          block={block}
          inputs={block.inputs}
          saved={undefined}
          results={results}
          open={open}
          locale={locale}
          resetAfterSend
          submitLabel={chat ? s.composeChatSend : s.composeAddEntry}
          keepFocus={chat}
          onSend={(values) => send(newEntryId(), values)}
        />
      )}
    </div>
  );
}
