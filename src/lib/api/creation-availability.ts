import { z } from "zod";

export const OWNER_APP_LIMIT = 2;
export const CreationAvailabilitySchema = z.object({
  used: z.number().int().nonnegative(),
  limit: z.number().int().positive().nullable(),
});
export type CreationAvailability = z.infer<typeof CreationAvailabilitySchema>;
export const creationBlocked = (value: CreationAvailability) => value.limit !== null && value.used >= value.limit;
