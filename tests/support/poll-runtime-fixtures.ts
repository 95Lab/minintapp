import { PollRuntimeManifestSchema, type PollRuntimeManifest } from "@/lib/blocks/poll-runtime-schema";
export function pollManifest(overrides: Partial<PollRuntimeManifest> = {}): PollRuntimeManifest {
  return PollRuntimeManifestSchema.parse({
    templateVersion: "poll-v1", appId: "a".repeat(24), deploymentId: "d".repeat(24), specHash: "c".repeat(64), hostname: "vote.runtime.example", expiresAt: Date.now() + 3600000,
    locale: "vi", theme: "sunset", title: "Cùng chọn đồ uống", description: "Một phiếu mỗi trình duyệt", blockTitle: "Đồ uống hôm nay", note: null,
    question: "Bạn chọn món nào?", resultsTitle: "Kết quả bình chọn", requireName: false,
    options: [{ id: "tea", label: "Trà" }, { id: "coffee", label: "Cà phê" }], resultsVisibility: "everyone", ...overrides,
  });
}
