export const ERROR_STATUS = {
  deployment_failed: 502, deployment_pending: 503, runtime_unavailable: 503,
  question_closed: 409, wheel_empty: 409, wheel_no_entrants: 409,
  storage_unavailable: 503, invalid_request: 400, app_closed: 409, forbidden: 403, not_found: 404, app_gone: 410, rate_limited: 429,
  ai_not_configured: 503, ai_timeout: 504, ai_refused: 422, ai_invalid_output: 502, ai_unavailable: 502, internal_error: 500,
} as const;
export type ErrorCode = keyof typeof ERROR_STATUS;
export class AppError extends Error {
  constructor(public readonly code: ErrorCode) { super(code); this.name = "AppError"; }
}
