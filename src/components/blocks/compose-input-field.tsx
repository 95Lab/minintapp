"use client";
import { useId } from "react";
import type { ComposeInput, ComposePayload } from "@/lib/blocks/compose/compose-atoms-schema";
import { parseComposeNumber } from "./compose-number-input";
type Value = ComposePayload["values"][string];
export interface ComposeInputFieldProps { input: ComposeInput; value?: Value; disabled?: boolean; onChange: (value: Value | undefined) => void }
export function ComposeInputField({ input, value, disabled, onChange }: ComposeInputFieldProps) {
  const id = useId();
  const options = input.options ?? [];
  if (input.kind === "choice" || input.kind === "slot") return <fieldset disabled={disabled}><legend>{input.label}{input.required && " *"}</legend>{options.map((option) => <label className="mini-option" key={option.id}><input type={input.multi ? "checkbox" : "radio"} name={id} value={option.id} checked={Array.isArray(value) ? value.includes(option.id) : value === option.id} onChange={(e) => {
    if (input.multi) { const values = Array.isArray(value) ? value : []; const next = e.target.checked ? [...values, option.id] : values.filter((v) => v !== option.id); onChange(next.length ? next : undefined); }
    else onChange(option.id);
  }} />{option.label}</label>)}</fieldset>;
  const numeric = input.kind === "number" || input.kind === "rating";
  return <label className="mini-field" htmlFor={id}>{input.label}{input.required && " *"}{input.unit && ` (${input.unit})`}<input id={id} disabled={disabled} required={input.required} type={numeric ? "number" : input.kind === "datetime" ? "datetime-local" : input.kind === "date" ? "date" : "text"} min={numeric ? input.min ?? (input.kind === "rating" ? 1 : undefined) : undefined} max={numeric ? input.max ?? undefined : undefined} step={input.kind === "rating" ? 1 : "any"} maxLength={input.kind === "text" ? 200 : undefined} value={typeof value === "number" || typeof value === "string" ? value : ""} onChange={(e) => onChange(numeric ? parseComposeNumber(e.target.value) ?? undefined : e.target.value || undefined)} /></label>;
}
