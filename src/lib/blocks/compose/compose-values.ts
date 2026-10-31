import type { ComposeInput, ComposePayload } from "./compose-atoms-schema";
export function shownInputs(inputs: readonly ComposeInput[], values: ComposePayload["values"]) {
  const shown = new Set<string>();
  return inputs.filter((input) => {
    const condition = input.showIf;
    const value = condition ? values[condition.input] : undefined;
    const visible = !condition || shown.has(condition.input) && (Array.isArray(value) ? value.includes(condition.equals) : value === condition.equals);
    if (visible) shown.add(input.id);
    return visible;
  });
}
export const emptyValue = (value: unknown) => value === undefined || value === "" || Array.isArray(value) && !value.length;
export function validValue(input: ComposeInput, value: unknown): boolean {
  if (emptyValue(value)) return !input.required;
  if (input.kind === "number" || input.kind === "rating") return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1e12 && value >= (input.min ?? (input.kind === "rating" ? 1 : -1e12)) && value <= (input.max ?? 1e12) && (input.kind !== "rating" || Number.isInteger(value));
  if (input.kind === "choice" || input.kind === "slot") {
    const allowed = (v: unknown) => typeof v === "string" && !!input.options?.some((o) => o.id === v);
    return input.kind === "choice" && input.multi ? Array.isArray(value) && new Set(value).size === value.length && value.every(allowed) : allowed(value);
  }
  if (typeof value !== "string" || value.length > 200) return false;
  if (input.kind === "text") return !!value.trim() || !input.required;
  const pattern = input.kind === "date" ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  if (!pattern.test(value)) return false;
  const date = new Date(input.kind === "date" ? `${value}T00:00:00Z` : `${value}:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, value.length) === value;
}
