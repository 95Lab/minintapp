"use client";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
import { useState } from "react";
import type { ComposeBlock as ComposeSpec } from "@/lib/blocks/compose/compose-block";
import type { ParticipantBlockProps } from "./block-ui-types";
import { ComposeRecordForm } from "./compose-record-form";
import { ComposeSteps } from "./compose-steps";
export function ComposeBlock({ block, open, onSubmit, myAnswers, runtime }: ParticipantBlockProps<ComposeSpec>) {
  const tr = useRuntimeTranslation();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState(0);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const step = runtime.blocks[block.id]?.step;
  const current = block.inputs.find((i) => i.id === step?.current);
  const many = block.entries === "many";
  const itemId = block.flow === "steps" ? current?.id ?? "" : editing ?? "";
  const saved = myAnswers?.[`${block.id}:${itemId}`];
  const entries = Object.entries(myAnswers ?? {}).filter(([key, value]) => key.startsWith(`${block.id}:e-`) && value.kind === "compose");
  const inputs = block.flow === "steps" ? current ? [{ ...current, showIf: null }] : [] : block.inputs;
  return <section className="mini-card"><h2>{block.title}</h2>{block.note && <p>{block.note}</p>}
    {block.flow === "steps" && <ComposeSteps block={block} runtime={runtime} />}
    {many && <><h3>{tr("Bản ghi của bạn (")}{entries.length}/50)</h3><ul>{entries.map(([key, payload], index) => <li key={key}>{payload.kind === "compose" && Object.values(payload.values).map((v) => Array.isArray(v) ? v.join(", ") : v).join(" · ")} <button type="button" disabled={!open || removing} onClick={() => { setEditing(key.slice(block.id.length + 1)); setDraft((n) => n + 1); }}>{tr("Sửa bản ghi ")}{index + 1}</button> <button type="button" disabled={!open || removing} onClick={async () => {
      if (!onSubmit) return; setRemoving(true); setError("");
      try { if (await onSubmit(key.slice(block.id.length + 1), { kind: "compose", values: {}, removed: true })) { if (key === `${block.id}:${editing}`) { setEditing(null); setDraft((n) => n + 1); } } else setError(tr("Chưa xóa được bản ghi.")); } catch { setError(tr("Chưa xóa được bản ghi.")); } finally { setRemoving(false); }
    }}>{tr("Xóa bản ghi ")}{index + 1}</button></li>)}</ul>{editing && <button type="button" onClick={() => { setEditing(null); setDraft((n) => n + 1); }}>{tr("Thêm bản ghi mới")}</button>}<p role="status">{error}</p></>}
    {!!inputs.length && <ComposeRecordForm key={`${block.id}:${itemId}:${draft}`} inputs={inputs} disabled={!open || removing || many && !editing && entries.length >= 50} initialValues={saved?.kind === "compose" ? saved.values : {}} onSubmit={onSubmit ? async (payload) => {
      const id = many ? editing ?? `e-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}` : itemId;
      const ok = await onSubmit(id, payload);
      if (ok && many) { setEditing(null); setDraft((n) => n + 1); }
      return ok;
    } : undefined} />}
  </section>;
}
