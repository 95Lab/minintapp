"use client";
import { useState } from "react";
import type { ComposeInput, ComposePayload } from "@/lib/blocks/compose/compose-atoms-schema";
import { ComposeInputField } from "./compose-input-field";
export function ComposeRecordForm({ inputs, initialValues = {}, disabled = false, onSubmit }: {
  inputs: ComposeInput[]; initialValues?: ComposePayload["values"]; disabled?: boolean;
  onSubmit?: (payload: ComposePayload) => Promise<boolean>;
}) {
  const [values, setValues] = useState(initialValues);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const visible = inputs.filter((i) => !i.showIf || (Array.isArray(values[i.showIf.input]) ? (values[i.showIf.input] as string[]).includes(i.showIf.equals) : values[i.showIf.input] === i.showIf.equals));
  return <form onSubmit={async (e) => { e.preventDefault(); if (busy || disabled || !onSubmit) return;
    const entries = visible.filter((i) => values[i.id] !== undefined).map((i) => [i.id, values[i.id]]);
    if (visible.some((i) => i.required && (values[i.id] === undefined || values[i.id] === "" || (Array.isArray(values[i.id]) && !(values[i.id] as string[]).length)))) { setMessage("Vui lòng điền các trường bắt buộc."); return; }
    setBusy(true); setMessage("");
    try { setMessage(await onSubmit({ kind: "compose", values: Object.fromEntries(entries) }) ? "Đã gửi câu trả lời." : "Chưa gửi được. Vui lòng thử lại."); }
    catch { setMessage("Không thể gửi. Vui lòng thử lại."); } finally { setBusy(false); }
  }}>{visible.map((input) => <ComposeInputField key={input.id} input={input} value={values[input.id]} disabled={disabled || busy || !onSubmit} onChange={(value) => { setValues((old) => { const next = { ...old }; if (value === undefined) delete next[input.id]; else next[input.id] = value; return next; }); setMessage(""); }} />)}<button disabled={disabled || busy || !onSubmit}>{busy ? "Đang gửi…" : "Gửi câu trả lời"}</button>{!onSubmit && <p>Chưa kết nối gửi dữ liệu.</p>}<p role="status">{message}</p></form>;
}
