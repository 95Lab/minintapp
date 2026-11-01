import {SubdomainSchema} from "@/lib/api/subdomain-schema";
// Runtime validation for every request body. Routes parse with these instead of casting,
// so malformed input becomes a 400 (never a 500) and only known keys are ever stored.
import { z } from "zod";
import { ResponsePayloadSchema } from "@/engine/blocks/block-registry";

const Token = z.string().min(16).max(64).regex(/^[A-Za-z0-9_-]+$/);
const ShortId = z.string().min(1).max(40);

export const GenerateRequestSchema = z
  .object({
    prompt: z.string().trim().min(1).max(500),
    subdomain:SubdomainSchema.optional(),
    lifetime: z.enum(["1h", "24h", "7d"]).default("1h"),
  })
  .strict();

export const RemixRequestSchema = z.object({ instruction: z.string().trim().min(1).max(300) }).strict();

// Answer payloads are defined by each brick and unioned in the registry.
export { ResponsePayloadSchema };

export const TemplateCreateRequestSchema = z
  .object({
    subdomain:SubdomainSchema.optional(),
    templateId: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
    locale: z.enum(["vi", "en"]).default("vi"),
    lifetime: z.enum(["1h", "24h", "7d"]).default("1h"),
  })
  .strict();

export const SubmitResponseRequestSchema = z
  .object({
    blockId: ShortId,
    itemId: z.string().max(40),
    participantToken: Token,
    displayName: z.string().max(40).nullable(),
    payload: ResponsePayloadSchema,
  })
  .strict();

export const BlockActionRequestSchema = z
  .object({
    blockId: ShortId,
    action: z.string().min(1).max(30).regex(/^[a-z_]+$/),
    args: z.record(z.string().max(30), z.union([z.string().max(60), z.number().finite(), z.boolean()])).optional(),
  })
  .strict();

export const LifecycleRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("close") }).strict(),
  z.object({ action: z.literal("end") }).strict(),
  z.object({ action: z.literal("reopen") }).strict(),
  z.object({ action: z.literal("extend"), by: z.enum(["1h", "24h", "7d"]) }).strict(),
  z.object({ action: z.literal("announce"), text: z.string().trim().min(1).max(140).nullable() }).strict(),
  // Shape only here; the route checks bank / account / name with PayeeInputSchema so the host gets a specific error.
  z.object({ action: z.literal("payee"), payee: z.object({ bin: z.string().max(10), account: z.string().max(40), name: z.string().max(100) }).strict().nullable() }).strict(),
  z.object({ action: z.literal("redirect"), toId: ShortId, toHostToken: Token }).strict(),
]);

/** Parses a JSON body against a schema; returns null on bad JSON or schema mismatch. */
export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T> | null> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return null;
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
