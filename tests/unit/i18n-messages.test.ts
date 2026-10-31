import { describe, expect, it } from "vitest";
import { translate } from "@/lib/i18n/messages";
import { apiErrorMessage } from "@/lib/i18n/api-error-message";
import { ApiClientError } from "@/lib/api/api-client";

describe("localized runtime messages", () => {
  it("interpolates values in both languages without interpreting inserted text", () => {
    const values = { current: 2, total: 3, label: "{current} <b>user text</b>" };
    expect(translate("en", "Bước {current}/{total}: {label}", values)).toBe("Step 2/3: {current} <b>user text</b>");
    expect(translate("vi", "Bước {current}/{total}: {label}", values)).toBe("Bước 2/3: {current} <b>user text</b>");
  });
  it("uses English singular and plural counts", () => {
    expect(translate("en", "{count} người tham gia", { count: 1 })).toBe("1 participant");
    expect(translate("en", "{count} người tham gia", { count: 2 })).toBe("2 participants");
  });
  it("uses localized contract error codes and preserves unknown server messages", () => {
    expect(apiErrorMessage(new ApiClientError(403, "server text", "forbidden"), "en", "fallback")).toBe("You do not have permission.");
    expect(apiErrorMessage(new ApiClientError(400, "specific error", "unknown"), "en", "fallback")).toBe("specific error");
    expect(apiErrorMessage(new Error("internal details"), "en", "Connection lost")).toBe("Connection lost");
  });
});
