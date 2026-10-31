"use client";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
import { useState } from "react";
import type { ComposeInput, ComposePayload } from "@/lib/blocks/compose/compose-atoms-schema";
import { shownInputs } from "@/lib/blocks/compose/compose-values";
import { ComposeInputField } from "./compose-input-field";
export function ComposeRecordForm({ inputs, initialValues = {}, disabled = false, onSubmit }: {
  inputs: ComposeInput[]; initialValues?: ComposePayload["values"]; disabled?: boolean;
  onSubmit?: (payload: ComposePayload) => Promise<boolean>;
}) {
  const tr = useRuntimeTranslation();
  const [values, setValues] = useState(initialValues);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const visible = shownInputs(inputs, values);
  return <form onSubmit={async (e) => { e.preventDefault(); if (busy || disabled || !onSubmit) return;
    const entries = visible.filter((i) => values[i.id] !== undefined).map((i) => [i.id, values[i.id]]);
    if (visible.some((i) => i.required && (values[i.id] === undefined || values[i.id] === "" || (Array.isArray(values[i.id]) && !(values[i.id] as string[]).length)))) { setMessage(tr("Vui lòng điền các trường bắt buộc.")); return; }
    setBusy(true); setMessage("");
    try { setMessage(await onSubmit({ kind: "compose", values: Object.fromEntries(entries) }) ? tr("Đã gửi câu trả lời.") : tr("Chưa gửi được. Vui lòng thử lại.")); }
    catch { setMessage(tr("Không thể gửi. Vui lòng thử lại.")); } finally { setBusy(false); }
  }}>{visible.map((input) => <ComposeInputField key={input.id} input={input} value={values[input.id]} disabled={disabled || busy || !onSubmit} onChange={(value) => { setValues((old) => { const next = { ...old }; if (value === undefined) delete next[input.id]; else next[input.id] = value; return next; }); setMessage(""); }} />)}<button disabled={disabled || busy || !onSubmit}>{busy ? tr("Đang gửi…") : tr("Gửi câu trả lời")}</button>{!onSubmit && <p>{tr("Chưa kết nối gửi dữ liệu.")}</p>}<p role="status">{message}</p></form>;
}
