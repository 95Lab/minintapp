import { z } from "zod";
export const Id = z.string().min(1).max(40).regex(/^[a-z0-9_-]+$/i).refine((id) => !["__proto__", "constructor", "prototype"].includes(id.toLowerCase()), "Reserved id");
export const Text = z.string().min(1).max(200);
export const OptionSchema = z.strictObject({ id: Id, label: Text });
export type Option = z.infer<typeof OptionSchema>;
export function uniqueIds(items: readonly { id: string }[]): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}
