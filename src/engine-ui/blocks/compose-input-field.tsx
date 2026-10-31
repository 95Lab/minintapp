"use client";
// One compose input atom on the participant's phone. Values are kept as strings / id arrays while
// editing and converted to the payload shape by the form (compose-record-form.tsx) on submit.
import type { ComposeInput } from "@/engine/app-spec/app-spec-schema";
import { wordCount } from "@/engine/blocks/compose/text-answer-filters";
import { t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";
import { formatVnd } from "./bar-chart-live";
import { parseNumberInput } from "./compose-number-input";
import { ComposePhotoField } from "./compose-photo-field";
import { ComposePlaceField } from "./compose-place-field";

export type DraftValue = string | string[];

const DEFAULT_RATING_MAX = 5;

export function ComposeInputField(props: {
  input: ComposeInput;
  value: DraftValue | undefined;
  onChange: (v: DraftValue) => void;
  disabled: boolean;
  /** slot inputs: option id → seats taken */
  seats: Record<string, number> | undefined;
  /** people picker: who is in the room */
  roster: Array<{ id: string; name: string }>;
  locale: UiLocale;
  /** the label repeats the block title (single-question blocks): keep it for screen readers only */
  hideLabel?: boolean;
  /** makes element ids unique when several blocks use the same input id (e.g. two polls) */
  idPrefix: string;
}) {
  const { input, value, onChange, disabled, seats, roster, locale, hideLabel, idPrefix } = props;
  const s = t(locale);
  const fieldId = `ci-${idPrefix}-${input.id}`;
  const labelId = `${fieldId}-label`;
  const label = (
    <label id={labelId} htmlFor={fieldId} className={hideLabel ? "sr-only" : undefined}>
      {input.label}
      {input.required && <span aria-hidden="true"> *</span>}
    </label>
  );

  if (input.kind === "text" || input.kind === "number") {
    const text = typeof value === "string" ? value : "";
    const notANumber = input.kind === "number" && text.trim() !== "" && parseNumberInput(text, input.unit) === null;
    return (
      <div className="field">
        {label}
        <div className="compose-number-row">
          <input
            id={fieldId}
            className={`input${input.kind === "number" ? " num" : ""}`}
            type="text"
            inputMode={input.kind === "number" ? (input.unit === "đ" ? "numeric" : "decimal") : undefined}
            maxLength={input.kind === "text" ? 200 : 20}
            aria-invalid={notANumber || undefined}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            required={input.required}
            disabled={disabled}
            autoComplete="off"
          />
          {input.unit && <span className="muted">{input.unit}</span>}
        </div>
        {notANumber && <div style={{ fontSize: 13, color: "var(--danger)" }}>{s.composeNotANumber}</div>}
        {input.kind === "text" && input.max !== null && typeof value === "string" && (
          <div className="muted num" style={{ fontSize: 13, color: wordCount(value) > input.max ? "var(--danger)" : undefined }}>
            {s.maxWords(wordCount(value), input.max)}
          </div>
        )}
      </div>
    );
  }

  if (input.kind === "date" || input.kind === "datetime") {
    return (
      <div className="field">
        {label}
        <input
          id={fieldId}
          className="input num"
          type={input.kind === "date" ? "date" : "datetime-local"}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          required={input.required}
          disabled={disabled}
        />
      </div>
    );
  }

  if (input.kind === "rating") {
    const max = input.max ?? DEFAULT_RATING_MAX;
    const current = typeof value === "string" ? Number(value) : 0;
    return (
      <div className="field">
        {label}
        <div className="stars" role="radiogroup" id={fieldId} aria-labelledby={labelId}>
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={current === n}
              aria-label={`${n}/${max}`}
              className={`star${n <= current ? " on" : ""}`}
              onClick={() => onChange(String(n))}
              disabled={disabled}
            >
              ★
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (input.kind === "photo") {
    return <ComposePhotoField fieldId={fieldId} label={label} value={typeof value === "string" ? value : ""} onChange={onChange} disabled={disabled} locale={locale} />;
  }

  if (input.kind === "place") {
    return <ComposePlaceField fieldId={fieldId} label={label} value={typeof value === "string" ? value : ""} onChange={onChange} disabled={disabled} locale={locale} />;
  }

  if (input.kind === "buzz") {
    // One big button; once pressed it stays pressed (the server keeps the first press time).
    const pressed = value === "1" || (Array.isArray(value) && value.includes("1"));
    // The round name describes the button; its accessible name stays "BUZZ!" (a <label for> would replace it).
    return (
      <div className="field">
        <div id={labelId} className={hideLabel ? "sr-only" : "field-label"}>
          {input.label}
        </div>
        <button type="button" id={fieldId} className={`buzz-btn${pressed ? " pressed" : ""}`} aria-pressed={pressed} aria-describedby={labelId} disabled={disabled || pressed} onClick={() => onChange("1")}>
          {pressed ? s.composeBuzzed : s.composeBuzz}
        </button>
      </div>
    );
  }

  if (input.kind === "rank") {
    // Tap in order of preference: each tap appends; tapping a ranked option takes it (and the ones after it keep their order) out.
    const order = Array.isArray(value) ? value : [];
    const limit = input.max ?? input.options?.length ?? 0;
    return (
      <div className="field">
        {label}
        <p className="muted" style={{ margin: "0 0 6px", fontSize: 14 }}>{s.composeRankHint(limit)}</p>
        <div className="opt-list" role="group" id={fieldId} aria-labelledby={labelId}>
          {(input.options ?? []).map((o) => {
            const place = order.indexOf(o.id);
            return (
              <button
                key={o.id}
                type="button"
                className="opt"
                aria-pressed={place >= 0}
                aria-label={place >= 0 ? `${o.label}: ${s.composeRankPlace(place + 1)}` : o.label}
                onClick={() => onChange(place >= 0 ? order.filter((x) => x !== o.id) : order.length < limit ? [...order, o.id] : order)}
                disabled={disabled || (place < 0 && order.length >= limit)}
              >
                <span className="rank-badge num" aria-hidden="true">{place >= 0 ? place + 1 : ""}</span>
                <span style={{ flex: 1 }}>{o.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // choice / slot / person (people come from the roster)
  const picked = Array.isArray(value) ? value : typeof value === "string" && value ? [value] : [];
  const multi = (input.kind === "choice" || input.kind === "person") && !!input.multi;
  const options = input.kind === "person" ? roster.map((r) => ({ id: r.id, label: r.name, price: null })) : (input.options ?? []);
  if (input.kind === "person" && options.length === 0) {
    return (
      <div className="field">
        {label}
        <p className="muted" style={{ margin: 0 }}>{s.composeNobodyYet}</p>
      </div>
    );
  }
  return (
    <div className="field">
      {label}
      <div className="opt-list" role={multi ? "group" : "radiogroup"} id={fieldId} aria-labelledby={labelId}>
        {options.map((o) => {
          const taken = seats?.[o.id] ?? 0;
          const left = input.capacity !== null ? input.capacity - taken : null;
          return (
            <button
              key={o.id}
              type="button"
              className="opt"
              {...(multi ? { "aria-pressed": picked.includes(o.id) } : { role: "radio", "aria-checked": picked.includes(o.id) })}
              onClick={() => onChange(multi ? (picked.includes(o.id) ? picked.filter((x) => x !== o.id) : [...picked, o.id]) : o.id)}
              disabled={disabled}
            >
              <span className="mark" aria-hidden="true" />
              <span style={{ flex: 1 }}>{o.label}</span>
              {o.price ? <span className="muted num" style={{ fontSize: 14 }}>{formatVnd(o.price)}</span> : null}
              {left !== null && <span className="muted num" style={{ fontSize: 13 }}>{left > 0 ? s.composeSeatsLeft(left) : s.composeFull}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
