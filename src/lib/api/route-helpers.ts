import "server-only";
import { AppError, ERROR_STATUS } from "./app-error-codes";
import { errorMessage } from "@/lib/i18n/api-strings-vi-en";
import type { Locale } from "@/lib/app-spec/app-spec-schema";
export function errorResponse(error: unknown, locale: Locale = "vi"): Response {
  const code = error instanceof AppError ? error.code : "internal_error";
  // Never expose provider messages, request bodies or credentials in responses.
  return Response.json({ ok: false, code, message: errorMessage(code, locale) }, {
    status: ERROR_STATUS[code], headers: { "Cache-Control": "no-store" },
  });
}
