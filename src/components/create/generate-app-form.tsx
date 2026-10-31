"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClientError, createGeneratedApp } from "@/lib/api/api-client";
import type { GenerateEvent } from "@/lib/api/api-contract-types";
import { PromptComposer } from "./prompt-composer";
import { GenerationProgress } from "./generation-progress";
export function GenerateAppForm() {
  const router = useRouter();
  const [event, setEvent] = useState<GenerateEvent | null>(null);
  return <section className="mini-app" aria-label="Tạo ứng dụng bằng OpenAI"><h2>Mô tả nhu cầu, tạo ứng dụng</h2><p>Hiện hỗ trợ bình chọn một lựa chọn, quiz do host điều khiển và vòng quay bốc thăm.</p><PromptComposer onGenerate={async (input) => {
    setEvent({ stage: "thinking" });
    try {
      const result = await createGeneratedApp(input);
      if (!result.ok) throw new ApiClientError(400, result.message);
      if (!/^[a-f0-9]{24}$/.test(result.id)) throw new ApiClientError(502, "Phản hồi tạo ứng dụng không hợp lệ.");
      setEvent({ stage: "done", id: result.id, hostToken: result.hostToken, generation: result.generation });
      router.push(`/a/${result.id}/host`);
    } catch (error) { setEvent(null); throw error; }
  }} /><GenerationProgress event={event} /></section>;
}
