// scanAppSpec (T2 phishing/credential-harvesting scan). Positive cases assert ok=false with a
// specific issue tag; negative cases assert the three hero examples (incl. the password-safety
// demo quiz, which must NEVER be flagged) stay ok=true.
import { describe, it, expect } from "vitest";
import { scanAppSpec } from "@/engine/security/security-interfaces";
import { examplePasswordQuiz, exampleWorkshopVote, exampleMilkTeaOrder } from "@/engine/app-spec/app-spec-examples";
import type { AppSpecDraft } from "@/engine/app-spec/app-spec-schema";
import { runtimeSpec } from "./runtime-spec-test-helper";

describe("scanAppSpec — negative (must not flag legitimate apps)", () => {
  it("does not flag the password-safety demo quiz", () => {
    const result = scanAppSpec(runtimeSpec(examplePasswordQuiz), ["none"]);
    expect(result.ok).toBe(true);
  });

  it("does not flag the workshop vote example", () => {
    const result = scanAppSpec(runtimeSpec(exampleWorkshopVote), ["none"]);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("does not flag the milk tea order example", () => {
    const result = scanAppSpec(runtimeSpec(exampleMilkTeaOrder), ["none"]);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });
});

describe("scanAppSpec — positive (must flag phishing-style specs)", () => {
  it("flags a collect field asking for a password", () => {
    const spec: AppSpecDraft = {
      specVersion: 1,
      locale: "vi",
      title: "Xác nhận nhận quà",
      description: null,
      theme: "ink",
      requireName: false,
      blocks: [
        {
          type: "collect",
          id: "form",
          title: "Xác nhận",
          aggregate: "none",
          fields: [{ id: "pw", label: "Mật khẩu Facebook", kind: "short_text", options: null }],
        },
      ],
    };
    const result = scanAppSpec(runtimeSpec(spec), ["none"]);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.startsWith("credential_input:"))).toBe(true);
  });

  it("flags a collect select option asking for OTP", () => {
    const spec: AppSpecDraft = {
      specVersion: 1,
      locale: "vi",
      title: "Xác nhận đơn hàng",
      description: null,
      theme: "ink",
      requireName: false,
      blocks: [
        {
          type: "collect",
          id: "form",
          title: "Xác nhận",
          aggregate: "none",
          fields: [
            {
              id: "verify",
              label: "Phương thức xác nhận",
              kind: "select",
              options: [
                { label: "Nhập mã OTP ngân hàng", unitPrice: null },
                { label: "Gọi điện", unitPrice: null },
              ],
            },
          ],
        },
      ],
    };
    const result = scanAppSpec(runtimeSpec(spec), ["none"]);
    expect(result.ok).toBe(false);
    // Options are tapped, not typed: the "enter your OTP" wording is caught as an instruction.
    expect(result.issues.some((i) => i.startsWith("credential_instruction:"))).toBe(true);
  });

  it("flags a choice option asking the user to enter a password", () => {
    const spec: AppSpecDraft = {
      specVersion: 1,
      locale: "vi",
      title: "Vòng quay may mắn",
      description: null,
      theme: "sunset",
      requireName: false,
      blocks: [
        {
          type: "choice",
          id: "spin",
          question: "Bạn muốn nhận thưởng không?",
          multi: false,
          showResults: "live",
          options: [
            { id: "yes", label: "Có, nhập mật khẩu Facebook để nhận quà" },
            { id: "no", label: "Không" },
          ],
        },
      ],
    };
    const result = scanAppSpec(runtimeSpec(spec), ["none"]);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.startsWith("credential_instruction:"))).toBe(true);
  });

  it("flags a bank brand combined with login/prize wording in the title", () => {
    const spec: AppSpecDraft = {
      specVersion: 1,
      locale: "vi",
      title: "Đăng nhập Vietcombank để nhận thưởng",
      description: null,
      theme: "ink",
      requireName: false,
      blocks: [
        {
          type: "choice",
          id: "vote",
          question: "Xác nhận?",
          multi: false,
          showResults: "live",
          options: [
            { id: "a", label: "Có" },
            { id: "b", label: "Không" },
          ],
        },
      ],
    };
    const result = scanAppSpec(runtimeSpec(spec), ["none"]);
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("brand_login_or_prize_wording");
  });

  it("flags URL-like text anywhere in the spec", () => {
    const spec: AppSpecDraft = {
      ...exampleWorkshopVote,
      description: "Xem thêm tại http://phish-example.com/claim",
    };
    const result = scanAppSpec(runtimeSpec(spec), ["none"]);
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("url_like_text");
  });

  it("flags when the model itself reports a non-none riskFlag", () => {
    const result = scanAppSpec(runtimeSpec(exampleWorkshopVote), ["phishing"]);
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("model_risk_flag:phishing");
  });
});
