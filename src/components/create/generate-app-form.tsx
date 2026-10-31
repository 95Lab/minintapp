"use client";
import { translate } from "@/lib/i18n/messages";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClientError, requestJson, awaitProvisioned } from "@/lib/api/api-client";
import type { GenerateEvent } from "@/lib/api/api-contract-types";
import { PromptComposer } from "./prompt-composer";
import { GenerationProgress } from "./generation-progress";
export function GenerateAppForm() {
  const { locale } = useLocale();
  const tr = (message: Parameters<typeof translate>[1]) => translate(locale, message);
  const router = useRouter();
  const [event, setEvent] = useState<GenerateEvent | null>(null);
  return <section className="mini-app" aria-label={tr("Tạo ứng dụng bằng OpenAI")}><h2 className="heading-5">{tr("Hôm nay bạn cần gì?")}</h2><p className="body-6">{tr("Mô tả form, khảo sát, quiz, chi tiêu, chia nhóm hoặc mini game bạn cần.")}</p><PromptComposer onGenerate={async (input) => {
    setEvent({ stage: "thinking" });
    try {
      await requestJson("/api/session", { method: "POST" });
      const result = await awaitProvisioned(await requestJson<import("@/lib/api/api-contract-types").GenerateResponse>("/api/engine/generate",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json", "Idempotency-Key": crypto.randomUUID()},body:JSON.stringify(input)}, 310_000));
      if (!result.ok) throw new ApiClientError(400, result.message);
      if (!/^[a-f0-9]{24}$/.test(result.id)) throw new ApiClientError(502, tr("Phản hồi tạo ứng dụng không hợp lệ."));
      setEvent({ stage: "done", id: result.id, hostToken: result.hostToken, generation: result.generation });
      router.push(`/rooms/${result.id}/host`);
    } catch (error) { setEvent(null); throw error; }
  }} /><GenerationProgress event={event} /></section>;
}
