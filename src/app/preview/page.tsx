import "@/components/runtime-design.css";
import { composeSpec, quizSpec } from "@/lib/app-spec/app-spec-examples";
import { stripPrivateFields } from "@/lib/app-spec/strip-private-fields";
import { initialRuntime } from "@/lib/blocks/block-definition-types";
import { ComponentPreview } from "./preview-client";
export default function PreviewPage() {
  const runtime = initialRuntime();
  runtime.openQuestionId = "q1";
  const spec = { ...composeSpec(), title: "Ứng dụng mẫu", layout: "tabs" as const, blocks: [...composeSpec().blocks, ...quizSpec().blocks] };
  return <ComponentPreview spec={stripPrivateFields(spec, runtime)} runtime={runtime} />;
}
