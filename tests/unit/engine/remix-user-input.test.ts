import { describe, expect, it } from "vitest";
import { exampleWorkshopVote as workshopVoteDraft } from "@/engine/app-spec/app-spec-examples";
import { runtimeSpec } from "./runtime-spec-test-helper";

// Remix always starts from the stored (expanded) spec.
const exampleWorkshopVote = runtimeSpec(workshopVoteDraft);
import { buildRemixUserInput } from "@/engine/generation/remix-user-input";
import { withoutNulls } from "@/engine/generation/json-without-nulls";

describe("buildRemixUserInput", () => {
  it("includes the resultsSummary and instruction so the model can pick the winning topic", () => {
    const resultsSummary = "Bạn chọn phương án nào?: AI agent 12, Bảo mật 7, Dữ liệu 4, UX 2";
    const instruction = "Đổi thành quiz 3 câu về chủ đề vừa thắng";

    const input = buildRemixUserInput(exampleWorkshopVote, resultsSummary, instruction);

    expect(input).toContain(resultsSummary);
    expect(input).toContain(instruction);
    // the current spec travels without its null fields (prompt size), but with all of its content
    expect(input).toContain(JSON.stringify(withoutNulls(exampleWorkshopVote)));
    expect(input).toContain(exampleWorkshopVote.title);
    expect(input).not.toContain(":null");
  });

  it("marks an empty resultsSummary explicitly instead of leaving a blank line", () => {
    const input = buildRemixUserInput(exampleWorkshopVote, "", "thêm lựa chọn: E");
    expect(input).toContain("(chưa có kết quả)");
  });
});
