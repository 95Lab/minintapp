// One shared deadline (18s by default) covers moderation + generate + repair for a single request (route
// owns the AbortController; generateAppSpec/remixAppSpec only see the resulting AbortSignal).
// The tracker below approximates "time left on that deadline" from the moment the pipeline
// starts working, which is accurate enough to decide whether a repair call still fits.
// Local models (LM Studio) need much longer: GENERATION_DEADLINE_MS=120000. Clamped to 5 s – 5 min.
export const GENERATION_DEADLINE_MS = Math.min(300_000, Math.max(5_000, Number(process.env.GENERATION_DEADLINE_MS) || 18_000));

/** A repair call (~1 extra round-trip) is only attempted when at least this much time remains. */
export const REPAIR_MIN_REMAINING_MS = Math.max(6_000, Math.round(GENERATION_DEADLINE_MS / 3));

/**
 * Cap for one model call, so a stuck request leaves time for a retry instead of eating the whole deadline.
 * A deadline too short to fit two calls keeps the old single-call behaviour.
 */
export const ATTEMPT_TIMEOUT_MS = GENERATION_DEADLINE_MS >= 45_000 ? GENERATION_DEADLINE_MS - REPAIR_MIN_REMAINING_MS - 5_000 : GENERATION_DEADLINE_MS;

export interface DeadlineTracker {
  remainingMs(): number;
}

/**
 * `startedAt` defaults to `Date.now()`; tests pin it (or pass a `now` override via the returned
 * closure) to make "time remaining" deterministic without real sleeps.
 */
export function createDeadlineTracker(
  totalMs: number = GENERATION_DEADLINE_MS,
  startedAt: number = Date.now(),
  now: () => number = Date.now,
): DeadlineTracker {
  return { remainingMs: () => totalMs - (now() - startedAt) };
}
