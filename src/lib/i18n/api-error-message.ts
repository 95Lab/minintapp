import { ApiClientError } from "@/lib/api/api-client";
import { ERROR_STATUS, type ErrorCode } from "@/lib/api/app-error-codes";
import { errorMessage } from "./api-strings-vi-en";
import type { Locale } from "./locale";

export function apiErrorMessage(error: unknown, locale: Locale, fallback: string): string {
  if (!(error instanceof ApiClientError)) return fallback;
  if (error.code && Object.hasOwn(ERROR_STATUS, error.code)) return errorMessage(error.code as ErrorCode, locale);
  return error.message || fallback;
}
