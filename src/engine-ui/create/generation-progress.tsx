// Three-step progress list shown while the generator streams its stages.
import type { UiLocale } from "@/engine/i18n/ui-strings-vi-en";
import { t } from "@/engine/i18n/ui-strings-vi-en";

export type GenStage = "idle" | "thinking" | "validating" | "done";
const ORDER: GenStage[] = ["thinking", "validating", "done"];

export function GenerationProgress({ stage, locale }: { stage: GenStage; locale: UiLocale }) {
  const s = t(locale);
  const labels = [s.stageThinking, s.stageValidating, s.stageDone];
  const current = ORDER.indexOf(stage);
  return (
    <ol className="progress" aria-live="polite" style={{ listStyle: "none", margin: 0 }}>
      {ORDER.map((st, i) => {
        const state = i < current ? "done" : i === current ? (st === "done" ? "done" : "active") : "";
        return (
          <li key={st} className={`step ${state}`}>
            <span className="dot" aria-hidden="true">{state === "done" ? "✓" : ""}</span>
            {labels[i]}
          </li>
        );
      })}
    </ol>
  );
}
