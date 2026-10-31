import { z } from "zod";
import { Id } from "@/lib/blocks/block-schema-primitives";
import { ResponsePayloadSchema } from "@/lib/blocks/block-registry";
export const LifetimeSchema = z.enum(["1h", "24h", "7d"]);
const Token = z.string().min(16).max(64).regex(/^[A-Za-z0-9_-]+$/);
export const GenerateRequestSchema = z.strictObject({ prompt: z.string().trim().min(1).max(500), lifetime: LifetimeSchema.default("1h") });
export const RemixRequestSchema = z.strictObject({ instruction: z.string().trim().min(1).max(300) });
export const TemplateCreateRequestSchema = z.strictObject({
  templateId: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/), locale: z.enum(["vi", "en"]).default("vi"), lifetime: LifetimeSchema.default("1h"),
});
export const SubmitResponseRequestSchema = z.strictObject({
  blockId: Id, itemId: z.string().max(40), participantToken: Token, displayName: z.string().max(40).nullable(), payload: ResponsePayloadSchema,
});
export const BlockActionRequestSchema = z.strictObject({
  blockId: Id, action: z.string().min(1).max(30).regex(/^[a-z_]+$/),
  args: z.record(z.string().max(30), z.union([z.string().max(60), z.number().finite(), z.boolean()])).optional(),
});
export const LifecycleRequestSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("close") }), z.strictObject({ action: z.literal("end") }), z.strictObject({ action: z.literal("reopen") }),
  z.strictObject({ action: z.literal("extend"), by: LifetimeSchema }),
  z.strictObject({ action: z.literal("announce"), text: z.string().trim().min(1).max(140).nullable() }),
]);
export async function parseBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T> | null> {
  try {
    if (!request.body) return null;
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    let bytes = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 16_384) { await reader.cancel(); return null; }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    const result = schema.safeParse(JSON.parse(text));
    return result.success ? result.data : null;
  } catch { return null; }
}
